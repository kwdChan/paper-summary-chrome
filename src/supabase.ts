export const SUPABASE_URL = "https://mbjyxjgolhbfbkcnocdu.supabase.co";
export const SUPABASE_API_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ianl4amdvbGhiZmJrY25vY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODE0NTQxNDAsImV4cCI6MTk5NzAzMDE0MH0.s96Llt-MtGgniS9uLdlQPUSul4uM1PCe9Ns62UsgqAc";

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

export const storageWrapper = {
  getItem: async (key: string) => {
    // @ts-ignore
    return (await chrome.storage.local.get(key))[[key]];
  },
  setItem: async (key: string, value: any) =>
    await chrome.storage.local.set({ [key]: value }),
  removeItem: async (key: string) => chrome.storage.local.remove(key),
};

class MySupabaseClient {
  client: SupabaseClient;
  user: User | null;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_API_KEY, {
      auth: { storage: storageWrapper },
    });
    this.user = null;
  }

  async setSession(session: {
    access_token: string;
    refresh_token: string;
  }) {
    // this is the signin method

    // at this point, the client object doesn't know the user id (even though it's in the access token)
    await this.client.auth.setSession(session);

    // refresh the session to get the user id
    const { data, error } = await this.client.auth.refreshSession();

    if (data) {
      this.user = data.user;
      return { user: this.user, error: null };

    } else {
      // the session data is expected to be valid because it is newly retrieved from the user

      // But maybe it could still occur? like network error?
      // consequence: this.user is left null.
      // will be retried by this.getUser

      // this will do for network error.
      console.warn("MySupabaseClient.setSession: ", error);
      return { user: null, error: error };
    }

  }

  async newHighlight(
    { article_digest, digest, text }: {
      article_digest: string | null;
      digest: string | null;
      text: string | null;
    },
  ) {
    const { user, error } = await this.getUser();

    if (!user) {
      return { data: null, errer: "no user" };
    }
    //console.log(user)
    const res = await this.client.from("highlight").insert({
      article_digest,
      digest,
      text,
      user_id: user.id,
    });
    console.log("newHighlight", res);

    return res;
  }

  async newArticle(
    { source, digest, title }: {
      source: string | null;
      digest: string | null;
      title: string | null;
    },
  ) {

    const { user, error } = await this.getUser();

    if (!user) return { data: null, error: error };

    //console.log(user)
    const res = await this.client.from("article").insert({
      digest,
      source,
      title,
      user_id: user.id,
    });
    console.log("newArticle", res);
    return res;
  }


  async getUser() {
    // return the user and ensure access token is not expired if logged in

    // if has user, make sure the access token is not expired
    if (this.user) {
      console.debug('getUser', this.user)
      await this.client.auth.getSession();
      return { user: this.user, error: null };
    }

    console.debug('getUser: refreshSession')
    // if no user, most likely, the user is not signed in.
    // but will try refreshSession anyway
    const { data, error } = await this.client.auth.refreshSession();

    if (data && data.user) {

      console.warn("MySupabaseClient.getUser: no user but refresh succeeded");

      this.user = data.user;
      return { user: this.user, error: null };

    } else {
      // error can be null...
      return { user: null, error: error };
    }
  }

  async getRefreshSession() {
    // this return the session with an unexpired access token immediately (but the refresh token may be expired)
    // it also refresh the session if the access token is expired
    return await this.client.auth.getSession();
  }

  signout() {
    this.user = null;
    return this.client.auth.signOut();
  }
}

export const supabaseClient = new MySupabaseClient();
