"use strict";
import { supabaseClient } from "./supabase";
import fnv from "fnv-plus";
import { webURL } from "./vars";
import { AuthError, PostgrestError } from "@supabase/supabase-js";


chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason == "install") {
    // This is a first install!

    chrome.tabs.create({url: webURL + "/getting-started"});
  }
});


// context menu
chrome.runtime.onInstalled.addListener(() => {

  chrome.contextMenus.create({
    id: "summarise",
    title: "Summarise the selected",
    contexts: ["selection"],
  });
});

// Handle signin and signout in
chrome.runtime.onMessage.addListener(
  async function receiveMessage(message, sender, sendResponse) {
    // TODO: check the sender
    if (message.message == "signin") {
      // sign in the extension

      if (message.payload.data) {

        // error handling
        const { session, error } = message.payload.data;

        // login in the extension
        await supabaseClient.setSession(session);
        managedWindow.open(`${webURL}/getting-started#how_to_use`);

        if (error) {

          // this error isn't ready possible

          console.warn('receiveMessage: signin failed')
        }

      } else {
        console.warn('receiveMessage:  message error')
        // TODO: error message page
      }
    }

    if (message.message == "signout") {
      // signout the extension
      supabaseClient.signout();
    }
  },
);

// entrances
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  if (info.menuItemId === "summarise") {
    await userTriggerCommand_summary();
  }
});

chrome.commands.onCommand.addListener(async function (command) {
  if (command === "summarise") {
    await userTriggerCommand_summary();
  }
});

async function userTriggerCommand_summary() {
  const { user } = await supabaseClient.getUser();
  if (!user) {
    // let errorMsg = "Extension not logged in. <br> If the page is logged in, try logging out and logging in again."
    managedWindow.open(`${webURL}/sign-in/passwordless?extensionSignin=true`);

    // force the webpage to signout
    return;
  }

  const { data, error } = await extensionSendSpotlight();
  if (data) {
    const { articleDigest, highlightDigest } = data!;
    managedWindow.open(
      `${webURL}/article/${articleDigest}?highlight_digest=${highlightDigest}`,
    );
  } else if (error === "no tab") {
    console.log("no tab");
    let errorTitle = "Page not found"
    let errorMsg = "Note that only webpages are supported. Local files and PDFs are not supported."

    managedWindow.open(
      `${webURL}/getting-started?errorTitle=${errorTitle}&errorMessage=${errorMsg}`,
    );

  } else if (error === "hashing error?") {
    let errorTitle = "Error"
    let errorMsg = "There may be unhandled characters. Note that PDFs and other non-html contents are not yet supported. "

    managedWindow.open(
      `${webURL}/getting-started?errorTitle=${errorTitle}&errorMessage=${errorMsg}`,
    );
  } else if (error === "content script error") {
    let errorTitle = "Parsing error"
    let errorMsg = "There may be unexpected characters. Note that PDFs and other non-html contents are not yet supported. "

    managedWindow.open(
      `${webURL}/getting-started?errorTitle=${errorTitle}&errorMessage=${errorMsg}`,
    );

  } else if (error === "Could not establish connection") {

    let errorTitle = "Reload the page"
    let errorMsg = "Please reload the page and try again for fresh installation and update. Note that only webpages are supported."

    managedWindow.open(
      `${webURL}/getting-started?errorTitle=${errorTitle}&errorMessage=${errorMsg}`,
    );
  }
}

type extensionSendSpotlightError =
  | "no tab"
  | "hashing error?"
  | "content script error"
  | "Could not establish connection";
type extensionSendSpotlightData = {
  articleDigest: string;
  highlightDigest: string;
};
async function extensionSendSpotlight(): Promise<
  Result<extensionSendSpotlightData, extensionSendSpotlightError>
> {
  let result: SelectionResponse;

  let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  let tabID = tabs[0].id;

  if (!tabID) {
    console.log("extensionSendSpotlight", "no tab");
    return { data: null, error: "no tab" };
  }

  try {
    // throw an error in case of void
    result =
      (await chrome.tabs.sendMessage(tabID, {
        message: "selection",
      }))! as unknown as SelectionResponse;
  } catch (error) {

    if ((error as Error).message == "Could not establish connection. Receiving end does not exist."){

      return { data: null, error: "Could not establish connection" };
    }
    else{

      return { data: null, error: "content script error" };

    }
  }

  // sending the spotlight and article to the server
  try {
    const htmlTagsAsString = JSON.stringify(result.contentHTMLTags);

    const articleDigest = fnv.hash(htmlTagsAsString, 64).str();
    const highlightDigest = fnv.hash(result.highlighted, 64).str();

    // TODO: handling insertion error
    // there're unique contraint on article digest and highlight digest and user id on the database
    // there's still possibity that the token is cancelled
    supabaseClient.newHighlight({
      article_digest: articleDigest,
      digest: highlightDigest,
      text: result.highlighted,
    }).then(({data, error, res}) => {
      if (res?.error){
        handleNetworkError(res?.error, res?.status);
        return
      }
    });

    supabaseClient
      .newArticle({
        digest: articleDigest,
        source: htmlTagsAsString,
        title: result.metadata.title,
      })
      .then(({data, error, res}) => {
        if (res?.error){
          handleNetworkError(res?.error, res?.status);
          return
        }
      });

    return { data: { articleDigest, highlightDigest }, error: null };
  } catch (error) {
    console.log("extensionSendSpotlight: parsing erroring: ", error);
    return { data: null, error: "hashing error?" };
  }
}

function handleNetworkError(error: PostgrestError, status: number | null ) {
  console.log("error", error);
  if (!error) return;

  //this is database replication error, ignore it
  if (status === 409 && error.code === "23505") {
    return;
  }
  if (status === 406) {
    managedWindow.open(
      `${webURL}/article?errorTitle=Cold start error&errorMessage=${"please try again"}`,
    );
    return;
  } else {

    managedWindow.addQuery(`errorTitle=Unanticipated Error. &errorMessage=${error.message}`);
  }
  // 403: row level security error (no auth)
}

class ManagedWindow {
  opened: null | chrome.windows.Window;
  currentURL: string | null;
  constructor() {
    this.opened = null;
    this.currentURL = null;
  }

  async open(url: string) {
    try{

      await this.focusTheWindow();
      await this.changeURL(url);

    } catch {
      this.currentURL = url;
      this.opened = await this.actuallyOpeningAWindow(url);
    }

    this.sendMessage({ message: "addTrace" });
    chrome.tabs.onUpdated.addListener(this.instructAddTrace.bind(this));
  }

  async addQuery(query: string) {

    const sym = this.currentURL!.includes("?") ? "&" : "?";
    await this.changeURL(`${this.currentURL!.split("#")[0]}${sym}${query}`);

  }


  async actuallyOpeningAWindow(url: string) {
    this.opened = await chrome.windows.create({
      url: url,
      type: "popup",
      width: 500,
      //height: 700
    });

    return this.opened;
  }

  changeURL(url: string) {
    this.currentURL = url;

    return chrome.tabs.update(this.opened!.tabs![0].id!, { url: url });
  }
  instructAddTrace(tabId: any, changeInfo: any, tab: any) {
    if (changeInfo.status === "complete") {
      return this.sendMessage({ message: "addTrace" });
    }
  }
  sendMessage(message: any, attempt: number=0) {
    try{
      return chrome.tabs.sendMessage(this.opened!.tabs![0].id!, message);
    } catch {
      console.log("sendMessage", "error", attempt)
      setTimeout(() => this.sendMessage(message, attempt+1), 100);
    }
  }

  focusTheWindow() {
    return chrome.windows.update(this.opened!.id!, { focused: true });
  }
}
const managedWindow = new ManagedWindow();
