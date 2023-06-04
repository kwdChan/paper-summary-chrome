"use strict";
import { supabaseClient } from "./supabase";
import fnv from "fnv-plus";
import { webURL } from "./vars";

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
        managedWindow.open(`${webURL}/howToUse`);

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
    managedWindow.open(`${webURL}/signin?extensionSignin=true`);

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
    // let errorMsg = "Please reload the page and try again for fresh installations. <br> Note that PDFs and other non-html contents are not yet supported."
    // managedWindow.open(`${webURL}?error=${errorMsg}`)
  } else if (error === "parsing error") {
    // let errorMsg = "Oops! Something went wrong. Please reload the page. <br> Note that PDFs and other non-html contents are not yet supported."

    // // has user but cannot refresh session
    // managedWindow.open((`${webURL}?error=${error}`))
  } else if (error === "content script error") {
    // let errorMsg = "Oops! Something went wrong. Please reload the page. <br> Note that PDFs and other non-html contents are not yet supported."

    // // has user but cannot refresh session
    // managedWindow.open((`${webURL}?error=${error}`))
  }
}

type extensionSendSpotlightError =
  | "no tab"
  | "parsing error"
  | "content script error";
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
  } catch {
    console.log("extensionSendSpotlight", "content script error");
    return { data: null, error: "content script error" };
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
    });

    supabaseClient
      .newArticle({
        digest: articleDigest,
        source: htmlTagsAsString,
        title: result.metadata.title,
      })
      .then(({ data, error }) => {
        handleNetworkError(error, null);
      });

    return { data: { articleDigest, highlightDigest }, error: null };
  } catch (error) {
    console.log("extensionSendSpotlight: parsing erroring: ", error);
    return { data: null, error: "parsing error" };
  }
}

function handleNetworkError(error: any, status: unknown) {
  console.log("handleNetworkError", error);

  //this is database replication error, ignore it
  if (status === 409 && error.code === "23505") {
    return;
  }
  if (status === 406) {
    managedWindow.open(
      `${webURL}?error=${"Cold start issue: please try again"}`,
    );
    return;
  }
  // 403: row level security error (no auth)
  // TODO: send a message to popup.js to show error message

  //managedWindow.open((`popup.html?status=${status}`));
}

class ManagedWindow {
  opened: null | chrome.windows.Window;

  constructor() {
    this.opened = null;
  }

  async open(url: string) {
    try{

      await this.focusTheWindow();
      await this.changeURL(url);

    } catch {
      this.opened = await this.actuallyOpeningAWindow(url);
    }

    this.sendMessage({ message: "addTrace" });
    chrome.tabs.onUpdated.addListener(this.instructAddTrace.bind(this));
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
