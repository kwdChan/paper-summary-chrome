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
  }
  else {
    console.log(client)
    console.log(user)
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
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GREETINGS') {
    const message = `Hi ${
      sender.tab ? 'Con' : 'Pop'
    }, my name is Bac. I am from Background. It's great to hear from you.`;

    // Log message coming from the `request` parameter
    console.log(request.payload.message);
    // Send a response message
    sendResponse({
      message,
    });
  }
});
