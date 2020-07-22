import { Control } from "../control.js"
import { ControlNotificationButton } from "./button/controlnotificationbutton.js";
import { GoogleAccount } from "../google/account/googleaccount.js";
import { EventBus } from "../eventbus.js";
import { UtilDOM } from "../utildom.js";
import { NotificationInfo } from "./notificationinfo.js";

export class ControlNotification extends Control{
    constructor(notification){
        super();        
        this.notification = notification;
    }
    get dynamicElements(){
        return true;
    }
    getHtmlFile(){
        return "./v2/notification/notification.html";
    }
    getStyleFile(){
        return "./v2/notification/notification.css";
    }
    
    async renderSpecific({root}){        
        //this.contentElement = root;
        this.messageElement = await this.$("#message");
        this.titleElement = await this.$(".notificationtitle");
        this.bodyElement = await this.$(".notificationBody");
        this.textElement = await this.$("#text");
        this.iconDataElement = await this.$(".notificationicon");
        this.appNameElement = await this.$(".appname");
        this.statusBarIconElement = await this.$("#iconstatusbar");
        this.deviceElement = await this.$("#device");
        this.dateElement = await this.$(".notificationdate");
        this.buttonsElement = await this.$("#buttons");
        this.replyElement = await this.$("#reply");
        this.replyTextElement = this.replyElement.querySelector("input");
        this.sendElement = await this.$("#send");
        this.imageWrapElement = await this.$("#notificationimagewrap");
        this.imageElement = await this.$("#image");
        this.notificationCloseElement = await this.$(".notificationclosebutton");

        this.iconDataElement.src = "./images/join.png";
        if(!this.notification.appName){
            this.notification.appName = "Join";
        }
        if(!this.notification.date){
            this.notification.date = new Date().getTime();
        }
        if(this.notification.date.formatDate){
            this.notification.date = this.notification.date.formatDate({full:true})
        }
        this.setDismissEverywhereButton();
        this.data = this.notification;
        
        // if(!this.notification.iconData){
        //     this.iconDataElement.src = "../join.png";
        // }
        const sendReply = async () =>{            
            const options = {text:this.values.replyText,notification:this.notification};
            this.replyTextElement.value = "";
            await EventBus.post(new RequestReplyMessage(options));
        }
        this.sendElement.onclick = sendReply;
        UtilDOM.onEnterKey(this.replyTextElement,sendReply);

        UtilDOM.showOrHide(this.replyElement,this.notification.replyId);
        UtilDOM.showOrHide(this.statusBarIconElement,this.notification.statusBarIcon);
        UtilDOM.showOrHide(this.imageWrapElement,this.notification.image);
        UtilDOM.showOrHide(this.notificationCloseElement,this.notification.canClose);
        this.notificationCloseElement.onclick = async () => await EventBus.post(new RequestNotificationClose(this.notification));
        if(this.controlsButtons){
            this.buttonsElement.innerHTML = "";
            UtilDOM.show(this.buttonsElement);
            for(const controlButton of this.controlsButtons){
                const buttonRender = await controlButton.render();
                this.buttonsElement.appendChild(buttonRender);
            }            
        }else{
            UtilDOM.hide(this.buttonsElement);
        }
        const deviceName = this.notification.device ? this.notification.device.deviceName : "Uknown Device";
        this.deviceElement.innerHTML = deviceName;

        this.bodyElement.onclick = async e => await EventBus.post(new RequestNotificationAction({},this.notification));

    }
    setDismissEverywhereButton(){
        const dismissAction = GCMNotificationBase.notificationDismissAction;
        dismissAction.actionId = dismissAction.action;
        dismissAction.text = dismissAction.title;
        this.controlsButtons = [new ControlNotificationButton(dismissAction,this.notification)];
    }
    set buttons(value){
        this.setDismissEverywhereButton();

        value.forEach(button=>{
            if(button.text == GCMNotificationBase.notificationDismissAction.title) return;
            if(button.text == GCMNotificationBase.notificationReplyAction.title) return;

            const controlButton = new ControlNotificationButton(button,this.notification);
            this.controlsButtons.push(controlButton);
        })
        // this.controlsButtons = value.map(button=>{
        //     const controlButton = new ControlNotificationButton(button,this.notification);
        //     return controlButton;
        // })
    }
    get buttons(){
        return "bla";
    }

}
class RequestReplyMessage{
    constructor({text,notification}){
        this.text = text;
        this.notification = notification;
    }
}
export class RequestNotificationAction{
    constructor(notificationButton,notification){
        this.notificationButton = notificationButton;
        this.notification = notification;
    }
}
export class RequestNotificationClose{
    constructor(notification){
        this.notification = notification;
    }
}