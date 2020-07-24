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
    getHtml(){
        return `
        <div class="buttontextwrapper">
            <div class="buttontext" id="text">Do stuff</div>
        </div>
        `
    }
    getStyle(){
        return `
        .buttonicon{
            height:24px;
            opacity: 0.5;
            width:24px;
        }
        `
    }
    
    async renderSpecific({root}){ 
        this.buttonElement = root;       
        this.textElement = await this.$("#text");

        this.data = this.notificationButton;
        this.buttonElement.onclick = async e => await EventBus.post(new RequestNotificationAction(this.notificationButton,this.notification));
    }
}