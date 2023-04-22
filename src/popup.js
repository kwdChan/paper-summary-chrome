'use strict';

import './popup.css';

import { getClient } from './supabase.js';
(function () {




  const form = document.getElementById('signin-form');
  const button = document.getElementById('signin-button');
  const usernameInput = document.getElementById('username')
  const passwordInput = document.getElementById('password')


  form.addEventListener('submit', async (event) => {

    event.preventDefault();

    const username = usernameInput.value;
    const password = passwordInput.value;

    usernameInput.value = ''
    passwordInput.value = ''


    const {client, user} = await getClient()
    console.log(client)selectedselected

    const { data, error } = await client.auth.signInWithPassword({
      email: username,
      password: password,
    })
    console.log(error)

  });

})();
