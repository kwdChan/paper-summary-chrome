'use strict';

import './popup.css';
import { webURL } from './vars';
import { getClient, supabaseClient } from './supabase.js';
console.log(webURL);

(async function () {

  await chrome.runtime.sendMessage({event:'popup_activated'})

})();

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const {event, data, error } = message;
  if (event === 'popup_activated_response') {
    if (data){
      const query = `/${data.articleDigest}?highlight_digest=${data.highlightDigest}`
      console.log('query', query)
      showIframe('/article' + query);
    } else if (error=='no user'){
      showForm();
    }
    else{
      console.log(error)
      showError(error);
    }
  }
});


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


function showForm() {
  const form = document.getElementById('signin-form');
  //const button = document.getElementById('signin-button');
  const signupButton = document.getElementById('signup-button');

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  signupButton.addEventListener('click', () => {
    form.style.display = 'none';
    showIframe('/signup');
  });

  form.style.display = 'block';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = usernameInput.value;
    const password = passwordInput.value;

    const {data, error} = await supabaseClient.signIn(username, password)

    if (!error) {
      form.style.display = 'none';
      showIframe();
    }

    usernameInput.value = '';
    passwordInput.value = '';
  });
}
