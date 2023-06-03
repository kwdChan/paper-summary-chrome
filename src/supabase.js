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

class MySupabaseClient  {

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_API_KEY, {
      auth: { storage: storageWrapper },
    })
  }


  async setSession(session){
    //console.log(session)
    await this.client.auth.setSession(session)

    const {data , error} = await this.client.auth.refreshSession();

    //console.log("setSession", data)
    //console.log("setSession", error)
  }

  signIn (email, password) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  async newHighlight ({article_digest, digest, text}) {
    const {user, error} = await this.getUser()

    if (!user){
      return {data:null, errer:'no user'}
    }
    //console.log(user)
    const res = await this.client.from('highlight').insert({article_digest, digest, text, user_id: user.id})
    console.log('newHighlight', res)

    return res
  }

  async newArticle ({source, digest, title}) {
    const {user, error} = await this.getUser()

    if (!user){return {data: null}}
    //console.log(user)
    const res = await this.client.from('article').insert({ digest, source, title, user_id: user.id})
    console.log('newArticle', res)
    return res
  }

  async getUser(){
    if (this.user) {
      console.log("getUser", this.user)
      return {user: this.user, error: null}
    }
    const {data , error} = await this.client.auth.refreshSession();
    console.log("getUser", data)
    console.log("getUser", error)
    if (data){
      this.user = data.user
      return {user: this.user, error: null}
    }
    else{
      return {user: null, error: error}
    }

  }

  async getRefreshSession () {

    // this return the unexpired session immediately without checking if it's valid
    return await this.client.auth.getSession()
  }

  signout () {
    this.user = null
    return this.client.auth.signOut();
  }
}


export const supabaseClient = new MySupabaseClient()

