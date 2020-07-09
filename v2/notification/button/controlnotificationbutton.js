import { Control } from "../../control.js"
import { EventBus } from "../../eventbus.js";
import { RequestNotificationAction } from "../controlnotification.js";

export class ControlNotificationButton extends Control{
    constructor(notificationButton,notification){
        super();
        this.notificationButton = notificationButton;
        this.notification = notification;
    }
    get dynamicElements(){
        return true;
    }
    getHtmlFile(){
        return "./v2/notification/button/notificationbutton.html";
    }
    getStyleFile(){
        return "./v2/notification/button/notificationbutton.css";
    }
    
    async renderSpecific({root}){ 
        this.buttonElement = root;       
        this.textElement = await this.$("#text");

        this.data = this.notificationButton;
        this.buttonElement.onclick = async e => await EventBus.post(new RequestNotificationAction(this.notificationButton,this.notification));
    }
}