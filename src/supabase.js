export const SUPABASE_URL = 'https://mbjyxjgolhbfbkcnocdu.supabase.co';
export const SUPABASE_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ianl4amdvbGhiZmJrY25vY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODE0NTQxNDAsImV4cCI6MTk5NzAzMDE0MH0.s96Llt-MtGgniS9uLdlQPUSul4uM1PCe9Ns62UsgqAc';

import { createClient } from '@supabase/supabase-js';

export const storageWrapper = {
  getItem: async (key) => {
    return  (await chrome.storage.local.get(key))[[key]]
  },
  setItem: async (key, value) => await chrome.storage.local.set({[key]: value}),
  removeItem: async (key) => chrome.storage.local.remove(key),
};

export async function getClient() {
  const client = createClient(SUPABASE_URL, SUPABASE_API_KEY, {
    auth: { storage: storageWrapper },
  });
  const {
    data:{user} ,
  } = await client.auth.getUser();

  console.log("getClient:user", user);
  console.log("getClient:client", client);
  return { client, user };

}

class MySupabaseClient  {

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_API_KEY, {
      auth: { storage: storageWrapper },
    })
  }

  signIn (email, password) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  async newHighlight ({article_digest, digest, text}) {
    const user = await this.getUser()

    if (!user){
      return {data:null, errer:'no user'}
    }
    const res = await this.client.from('highlight').insert({article_digest, digest, text, user_id: user.id})
    console.log('newHighlight', res)

    return res
  }

  async newArticle ({source, digest, title}) {
    const user = await this.getUser()

    if (!user){return {data: null}}
    const res = await this.client.from('article').insert({ digest, source, title, user_id: user.id})
    console.log('newArticle', res)
    return res
  }

  async getUser(){
    if (this.user) {
      return this.user
    }
    const {data , error} = await this.client.auth.refreshSession();
    return data.user
  }

  async getRefreshSession () {
    return await this.client.auth.getSession()
  }

  signout () {
    this.user = null
    return this.client.auth.signOut();
  }
}


export const supabaseClient = new MySupabaseClient()

