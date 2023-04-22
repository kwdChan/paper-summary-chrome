export const SUPABASE_URL = 'https://mbjyxjgolhbfbkcnocdu.supabase.co';
export const SUPABASE_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ianl4amdvbGhiZmJrY25vY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODE0NTQxNDAsImV4cCI6MTk5NzAzMDE0MH0.s96Llt-MtGgniS9uLdlQPUSul4uM1PCe9Ns62UsgqAc';

import { createClient } from '@supabase/supabase-js';

const storageWrapper = {
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
  const text = await client.auth.storage.getItem(client.auth.storageKey)
  console.log(text)


  // get session from chrome storage (throw error if not found)
  //const { session } = await chrome.storage.local.get('session');
  //console.log(session)

  //const { access_token, refresh_token, user } = session.data.session;
  //console.log(access_token)
  const {
    data: { user },
  } = await client.auth.getUser();


  console.log(user);

  console.log(client);

  return { client, user };

}
