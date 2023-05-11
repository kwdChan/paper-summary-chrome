'use strict';
import { supabaseClient } from './supabase.js';
import fnv from 'fnv-plus';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'summarise',
    title: 'Summarise the selected',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  if (info.menuItemId === 'summarise') {
    await userTriggerCommand_summary()
  }
});

chrome.commands.onCommand.addListener(async function (command) {
  if (command === 'summarise') {
    await userTriggerCommand_summary()
  }
});


async function userTriggerCommand_summary(){
  const { data, error } = await extensionSendSpotlight();

  if (error) {
    if (error === 'no tab') {

      let errorMsg = "Please reload the page and try again for fresh installations. <br> Note that PDFs and other non-html contents are not yet supported."
      managed_window.open(chrome.runtime.getURL(`popup.html?error=${errorMsg}`))
    }

    else if (error === 'no user') {

      let errorMsg = "Extension not logged in. <br> If the page is logged in, try logging out and logging in again."

      // ask to login
      managed_window.open(chrome.runtime.getURL(`popup.html?error=${errorMsg}`))
    }

    else if (error === 'cannot refresh session') {

      let errorMsg = "Session expired. <br> If the page is logged in, try logging out and logging in again."
      // has user but cannot refresh session
      managed_window.open(chrome.runtime.getURL(`popup.html?error=${errorMsg}`))
    }

    else if (error === 'parsing error') {

      let errorMsg = "Oops! Something went wrong. Please reload the page. <br> Note that PDFs and other non-html contents are not yet supported."

      // has user but cannot refresh session
      managed_window.open(chrome.runtime.getURL(`popup.html?error=${error}`))
    }
    return;
  }

  const { articleDigest, highlightDigest } = data;
  managed_window.open(chrome.runtime.getURL(`popup.html?article_digest=${articleDigest}&highlight_digest=${highlightDigest}`));

}


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
  if (!data.session) {
    console.log('extensionSendSpotlight', 'no user');
    return { data: null, error: 'no user' };
  }
  if (error) {
    return { data: null, error: 'cannot refresh session' };
  }

  // sending the spotlight and article to the server
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

    console.log('extensionSendSpotlight: parsing erroring: ', error);
    return { data: null, error: 'parsing error' };

  }
}

function handleNetworkError(error, status) {
  console.log("handleNetworkError", error);

  //this is database replication error, ignore it
  if (status === 409 && error.code === "23505") {
    return;
  }

  // 403: row level security error (no auth)
  // TODO: send a message to popup.js to show error message

  //managed_window.open(chrome.runtime.getURL(`popup.html?status=${status}`));
}


function focusTheWindow(window) {
  return chrome.windows.update(window.id, { focused: true });
}

function changeURL(window, url) {
  return chrome.tabs.update(window.tabs[0].id, { url: url });
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

