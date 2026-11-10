/**
 * Inline <head> script (root layout): keeps Chrome's beforeinstallprompt from the very first moment,
 * before React hydrates, so the "Instalar" button can open Chrome's install dialog with one tap on any
 * page. preventDefault() swaps Chrome's own small install banner for ours. After a dismissal Chrome
 * fires a fresh event, which lands here too. ./client reads window.__chambaBIP.
 */
export const INSTALL_EVENT = "chamba:install";

export const INSTALL_SCRIPT = `(function(){try{var w=window;w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w.__chambaBIP=e;w.dispatchEvent(new Event("${INSTALL_EVENT}"))});w.addEventListener("appinstalled",function(){w.__chambaBIP=null;w.__chambaInstalled=true;w.dispatchEvent(new Event("${INSTALL_EVENT}"))})}catch(e){}})()`;
