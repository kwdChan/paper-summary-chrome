'use strict';
import {getClient} from './supabase.js';
import fnv from 'fnv-plus';


// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

///import { mySupabaseClient } from './supabase.js';

async function extensionSendSpotlight() {
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  let tabID = tabs[0].id;
  let result = await chrome.tabs.sendMessage(tabID, { message: 'selection' });

  const {client, user} = await getClient()

  if (user) {
    const htmlTagsAsString = JSON.stringify(result.contentHTMLTags)
    const articleDigest = fnv.hash(htmlTagsAsString, 64).str()
    const highlightDigest = fnv.hash(result.highlighted, 64).str()


    // there're unique contraint on article digest and highlight digest and user id on the database
    client.from('highlight').insert({ article_digest:articleDigest, digest: highlightDigest, text: result.highlighted, user_id: user.id}).then(({data, error }) => {console.log({data, error})})
    client.from('article').insert({ digest:articleDigest, source: htmlTagsAsString, title: result.metadata.title, user_id: user.id}).then(({data, error }) => {console.log({data, error})})

    console.log(result)
    return {data:{articleDigest, highlightDigest}, error:null}
  }
  else {
    console.log(client)
    console.log(user)
  }

  return {data:null, error:'error'}

}
// creation of the context menu, start of the logic
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'jvdnfdi',
    title: 'Summarise',
    contexts: ['selection'],
  });
});

//- get the selected text and create a thread
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  extensionSendSpotlight();
  chrome.tabs.sendMessage(tab.id, { action: 'createSidebar' })


});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse)=>{
  if (message.event==='popup_activated'){


    const {data, error} = await extensionSendSpotlight()
    chrome.runtime.sendMessage(
      {event:'popup_activated_response', data, error}
      )
  }
}
)
