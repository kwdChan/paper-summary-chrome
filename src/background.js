'use strict';
import {supabaseClient} from './supabase.js';
import fnv from 'fnv-plus';


// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

///import { mySupabaseClient } from './supabase.js';

async function extensionSendSpotlight() {
  let result
  try{
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabID = tabs[0].id;
    result = await chrome.tabs.sendMessage(tabID, { message: 'selection' });

  }catch{
    console.log('extensionSendSpotlight', 'no tab')
    return {data:null, error:'no tab'}
  }

  // refresh session
  const {data, error} = await supabaseClient.getRefreshSession()

  if (!data.session){
    console.log('extensionSendSpotlight', 'no user')
    return {data:null, error:'no user'}
  }
  try{
    const htmlTagsAsString = JSON.stringify(result.contentHTMLTags)
    const articleDigest = fnv.hash(htmlTagsAsString, 64).str()
    const highlightDigest = fnv.hash(result.highlighted, 64).str()

    // there're unique contraint on article digest and highlight digest and user id on the database
    supabaseClient.newHighlight({ article_digest:articleDigest, digest: highlightDigest, text: result.highlighted,})
    supabaseClient.newArticle({ digest:articleDigest, source: htmlTagsAsString, title: result.metadata.title})

    return {data:{articleDigest, highlightDigest}, error:null}
  } catch (error){

    console.log('extensionSendSpotlight', error)
    return {data:null, error:'data error'}
  }

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

//TODO: check sender
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse)=>{
  if (message.event==='popup_activated'){


    const {data, error} = await extensionSendSpotlight()
    chrome.runtime.sendMessage(
      {event:'popup_activated_response', data, error}
      )
  }
}
)
