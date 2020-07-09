import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";
import { PushHistory, Push } from "./pushhistory.js";

export class ControlPushHistory extends Control{
    /**
     * 
     * @param {PushHistory} pushHistory 
     */
    constructor(pushHistory){
        super();
        this.pushHistory = pushHistory;
    } 
    getHtml(){
        return `<div id="pushhistory"></div>`;
    }
    async renderSpecific({root}){
        this.pushHistoryElement = root;

        await this.renderList(this.pushHistoryElement,this.pushHistory,ControlPush,push=>push.type?true:false);
        Util.sleepUntil(100,10000,()=>{
            return this.pushHistoryElement.parentElement ? true : false;
        }).then(()=>{
            setTimeout(()=>UtilDOM.scrollToBottom(this.pushHistoryElement),300);
        });
        
        return root;
    }
    async updatePushHistory(pushHistory){
        this.pushHistory = pushHistory;
        await this.render();
    }
}

const htmlPush = `

`;
export class ControlPush extends Control{
    constructor(push){
        super();
        this.push = push;
    }
    // getHtml(){
    //     return htmlPush;
    // }
    getHtmlFile(){
        return "./v2/pushhistory/push.html";
    }
    getStyleFile(){
        return "./v2/pushhistory/push.css";
    }
    async renderSpecific({root}){
        this.pushElement = root;
        this.typeElement = await this.$(".pushtype");
        this.titleElement = await this.$(".pushtitle");
        this.textElement = await this.$(".pushtext");
        this.smsElement = await this.$(".sms");
        this.clipboardElement = await this.$(".pushclipboardholder");
        this.iconElement = await this.$(".pushicon");
        this.buttonsElement = await this.$(".pushbuttons");
        this.dateElement = await this.$(".pushdate");
        this.senderElement = await this.$(".pushsender");
        this.bottomElement = await this.$(".pushbottom");
        
        this.titleElement.innerHTML = "";
        this.textElement.innerHTML = "";
        const push = this.push;
        this.data = push;
        this.typeElement.innerHTML = push.type;
        if(push.isTypeSMS){
            this.titleElement.innerHTML = push.smsnumber;
            this.textElement.innerHTML = push.smstext;
        }
        if(push.isTypeClipboard){
            this.textElement.innerHTML = push.clipboard;
        }
        if(push.date){
            this.dateElement.innerHTML = push.date.formatDate({full:true});
        }
        const deviceSender = await push.sender;
        UtilDOM.showOrHide(this.senderElement,deviceSender);
        this.senderElement.innerHTML = `From ${deviceSender ? deviceSender.deviceName : "Unknown Sender"}`;
        UtilDOM.showOrHide(this.bottomElement,this.titleElement.innerHTML || this.textElement.innerHTML );
        UtilDOM.showOrHide(this.iconElement,push.icon);
        
        this.buttonsElement.innerHTML = "";
        const valueForButtons = this.push.valueForActions;
        UtilDOM.showOrHide(this.buttonsElement,valueForButtons);
        if(valueForButtons){
            this.addCopyButton();
            this.addOpenButton();
        }
        return root;
    }
    get dynamicElements(){
        return true;
    }
    addCopyButton(){
        if(!this.push.valueForActions) return;

        const onclick = async value =>{
            await Util.setClipboardText(value);
        }
        this.addButton({text:"Copy",onclick})
    }
    addOpenButton(){
        if(!this.push.canBeOpened) return;

        const onclick = async value =>{
            await Util.openWindow(value);
        }
        this.addButton({text:"Open",onclick})
    }
    addButton({text,onclick}){
        const buttonWrapperElement = document.createElement("div");
        buttonWrapperElement.classList.add("buttontextwrapper");
        const buttonElement = document.createElement("div");
        buttonElement.classList.add("pushbutton");
        buttonElement.classList.add("buttontext");
        buttonElement.innerHTML = text;
        buttonElement.onclick = async () => await onclick(this.push.valueForActions);
        buttonWrapperElement.appendChild(buttonElement);
        this.buttonsElement.appendChild(buttonWrapperElement);
    }
}