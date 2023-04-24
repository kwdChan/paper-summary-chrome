'use strict';

import './popup.css';
import { webURL } from './vars';
import { getClient } from './supabase.js';

(async function () {

  //

  // ui
  if (await isSignedIn()){
    console.log('showIframe')

    await chrome.runtime.sendMessage({event:'popup_activated'})

  } else {
    console.log('showForm')
    showForm()
  }


})();

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse)=>{
  if (message.event==="popup_activated_response"){

    const {data, error} = message
    console.log(message)


    const query = data? `/${data.articleDigest}?highlight_digest=${data.highlightDigest}`: ''
    showIframe('/article' + query)
  }
})


function showIframe(route='/article'){
  // Create a new iframe element
  const webapp = document.getElementById('webapp');

  // Set the source URL for the iframe
  webapp.src = webURL+route;

  // Set the width and height of the iframe
  webapp.width = '100%';
  webapp.height = '100%';

  // Append the iframe to the container element
  webapp.style.display = 'block'

}

async function isSignedIn(){
  const {client, user} = await getClient()
  console.log('isSignedIn:client', client)
  console.log('isSignedIn:user', user)
  return user != null
}

function showForm(){


  const form = document.getElementById('signin-form');
  const button = document.getElementById('signin-button');
  const usernameInput = document.getElementById('username')
  const passwordInput = document.getElementById('password')

  form.style.display = 'block'


  form.addEventListener('submit', async (event) => {

    event.preventDefault();

    const username = usernameInput.value;
    const password = passwordInput.value;




    const {client, user} = await getClient()
    console.log(client)
    const { data, error } = await client.auth.signInWithPassword({
      email: username,
      password: password,
    })
    console.log(error)

    if (!error){
      form.style.display = 'none'
      showIframe()
    }

    usernameInput.value = ''
    passwordInput.value = ''

  });



}
