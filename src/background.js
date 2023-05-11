'use strict';
import { supabaseClient } from './supabase.js';
import fnv from 'fnv-plus';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

///import { mySupabaseClient } from './supabase.js';
import { webURL } from './vars.js';

async function extensionSendSpotlight() {
  let result;
  try {
    let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tabID = tabs[0].id;
    result = await chrome.tabs.sendMessage(tabID, { message: 'selection' });
  } catch {
    console.log('extensionSendSpotlight', 'no tab');
    return { data: null, error: 'no tab' };
  }

  // this return the unexpired session immediately without checking if it's valid
  const { data, error } = await supabaseClient.getRefreshSession();
  console.log(data);
  if (!data.session) {
    console.log('extensionSendSpotlight', 'no user');
    return { data: null, error: 'no user' };
  }
  if (error) {
    return { data: null, error: 'cannot refresh session' };
  }
  try {
    const htmlTagsAsString = JSON.stringify(result.contentHTMLTags);
    const articleDigest = fnv.hash(htmlTagsAsString, 64).str();
    const highlightDigest = fnv.hash(result.highlighted, 64).str();

    // there're unique contraint on article digest and highlight digest and user id on the database
    // there's still possibity that the token is cancelled
    supabaseClient.newHighlight({
      article_digest: articleDigest,
      digest: highlightDigest,
      text: result.highlighted,
    });
    supabaseClient
      .newArticle({
        digest: articleDigest,
        source: htmlTagsAsString,
        title: result.metadata.title,
      })
      .then(({ data, error, status }) => {
        handleNetworkError(error, status);
      });

    return { data: { articleDigest, highlightDigest }, error: null };
  } catch (error) {
    console.log('extensionSendSpotlight', error);
    return { data: null, error: 'data error' };
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

function focusTheWindow(window) {
  return chrome.windows.update(window.id, { focused: true });
}

function changeURL(window, url) {
  return chrome.tabs.update(window.tabs[0].id, { url: url });
}
// TODO: handle the situation where the website is logged in but the extension is not
// TODO: handle the situation where the website and extension are logged into different accounts
function tryLogin(){


}

function requestLogin(window){


}

const managed_window = {
  opened: null,

  async open(url) {
    try {
      await focusTheWindow(this.opened);
      await changeURL(this.opened, url);
    } catch {
      this.opened = await this.actuallyOpeningAWindow(url);
    }
  },

  async actuallyOpeningAWindow(url) {
    this.opened = await chrome.windows.create({
      url: url,
      type: 'popup',
      width: 500,
      //height: 700
    });
    return this.opened;
  },
};

chrome.commands.onCommand.addListener(async function (command) {
  if (command === 'summarise') {

    console.log(command)
    const { data, error } = await extensionSendSpotlight();

    if (error) {
      console.log(error)
      ;
      //TODO
      managed_window.open(chrome.runtime.getURL(`popup.html?error=${error}`));
    } else {

      const { articleDigest, highlightDigest } = data;
      console.log(data)
      managed_window.open(chrome.runtime.getURL(`popup.html?article_digest=${articleDigest}&highlight_digest=${highlightDigest}`));

    }
  }
});

function handleNetworkError(error, status) {
  console.log("handleNetworkError", error);
  if (status === 409 && error.code === "23505") {
    return;
  }
  //managed_window.open(chrome.runtime.getURL(`popup.html?status=${status}`));
}



// //TODO: check sender
// chrome.runtime.onMessage.addListener(async (message, sender, sendResponse)=>{
//   if (message.event==='popup_activated'){

//     const {data, error} = await extensionSendSpotlight()
//     chrome.runtime.sendMessage(
//       {event:'popup_activated_response', data, error}
//       )
//   }
// }
// )

//   function(request, sender, sendResponse) {

//     console.log(request)
//   });
