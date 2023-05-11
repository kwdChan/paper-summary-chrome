'use strict';

import './popup.css';
import { webURL } from './vars';
import { supabaseClient } from './supabase.js';
console.log(webURL);

const errorMessages = {
  dom:  document.getElementById('error-msg'),
  show(message){
    this.dom.style.display = 'flex'
    this.dom.innerHTML = message;
  },
  hide(){
    this.dom.style.display = 'none'
  }
}

const { article_digest, highlight_digest, error } = parseUrlQueries();

if (article_digest) {
  showIframe(
    `/article/${article_digest}?highlight_digest=${highlight_digest}`
  );

} else if (error) {

  errorMessages.show(error);
  showIframe(`/signin`);
}

// Jandle signin and signout in iframe
window.addEventListener('message', receiveMessage, false);
async function receiveMessage({ origin, data, error }) {

  // origin? edible?

  if (data.message == 'signin') {

    if (data.payload.data) {

      // login in the extension as well
      await supabaseClient.setSession(data.payload.data.session);

      // TODO: tell user the reselect the text
      errorMessages.show('You are now logged in! You may now submit summarisation requests!')
      showIframe(`/article`);

    } else {

      // login failed
      errorMessages.show('Login failed. This is an unepxected error. Please contact the developer(s).')
      showIframe(`/signin`);
    }
  }

  if (data.message == 'signout') {

    // signout in the extension as well
    supabaseClient.signout();
    showIframe(`/signin`);
  }
}


function parseUrlQueries() {
  const urlParams = new URLSearchParams(window.location.search);
  const queryParams = {};
  //console.log(urlParams);
  //console.log(window.location.search);

  for (const [key, value] of urlParams.entries()) {
    queryParams[key] = value;
  }

  return queryParams;
}


function showIframe(route = '/article') {
  // Create a new iframe element
  const webapp = document.getElementById('webapp');

  // Set the source URL for the iframe
  webapp.src = webURL + route;

  // Set the width and height of the iframe
  webapp.width = '100%';
  webapp.height = '100%';
}

