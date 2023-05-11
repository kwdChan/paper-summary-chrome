'use strict';

import './popup.css';
import { webURL } from './vars';
import { getClient, supabaseClient } from './supabase.js';
console.log(webURL);

(async function () {
  const { article_digest, highlight_digest, error } = parseUrlQueries();
  
  if (article_digest) {
    showIframe(
      `/article/${article_digest}?highlight_digest=${highlight_digest}`
    );
  }

  if (error) {
    showIframe(`/signin`);
  }

  //await chrome.runtime.sendMessage({event:'popup_activated'})
  //console.log(chrome.runtime.getURL('popup.html'))
})();

function parseUrlQueries() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryParams = {};
  console.log(urlParams);
  console.log(window.location.search);

  for (const [key, value] of urlParams.entries()) {
    queryParams[key] = value;
  }

  return queryParams;
}

// Add event listener to receive messages from child frames
window.addEventListener('message', receiveMessage, false);

// Receive message from child frame
async function receiveMessage({ origin, data, error }) {
  if (data.message == 'signin') {
    console.log(data);
    if (data.payload.data) {
      await supabaseClient.setSession(data.payload.data.session);
      showIframe(`/article`);
    } else {
      showIframe(`/signin`);
    }
  }

  console.log('popup', origin, data, error);
  if (data.message == 'signout') {
    supabaseClient.signout();
    showIframe(`/signin`);
  }
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const { event, data, error } = message;
  console.log('popup', event, data, error);
  if (event === 'popup_activated_response') {
    if (data) {
      const query = `/${data.articleDigest}?highlight_digest=${data.highlightDigest}`;
      console.log('query', query);
      showIframe('/article' + query);
    } else if (error == 'no user') {
      showForm();
    } else {
      console.log(error);
      showError(error);
    }
  }
});

function hideIframe() {
  document.getElementById('webapp').style.display = 'none';
}

function showIframe(route = '/article') {
  // Create a new iframe element
  const webapp = document.getElementById('webapp');

  // Set the source URL for the iframe
  webapp.src = webURL + route;

  // Set the width and height of the iframe
  webapp.width = '100%';
  webapp.height = '100%';

  // Append the iframe to the container element
  webapp.style.display = 'block';
}

function showError(text) {
  //TODO
  const errorMsg = document.getElementById('error-msg');
  errorMsg.style.display = 'block';
}
