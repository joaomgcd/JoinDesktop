import { Control } from "../../control.js"
import { UtilDOM } from "../../utildom.js";
import { EventBus } from "../../eventbus.js";
import { FAB } from "../../fab/fab.js";
import { ControlFAB } from "../../fab/controlfab.js";

export class ControlSMSThreads extends Control{ 
    constructor(){
        super();
    }  
    getHtmlFile(){
        return "./v2/sms/thread/smsthreads.html";
    }    
    getStyleFile(){
        return "./v2/sms/thread/smsthreads.css";
    }
       
    async renderSpecific({root}){   
        this.container = root;   
        this.controlGlobalMessage = await this.$("#smsthreadsmessage");
        this.controlThreadList = await this.$("#smsthreads");
        
        if(!this.fabElement){
            const controlFab = new ControlFAB(
                new FAB({icon:"+"}),
                [
                    FAB.sms,
                    FAB.call
                ]
            );
            this.fabElement = await controlFab.render();
            this.container.appendChild(this.fabElement);
        }

        await this.renderControlsThreadList();
    }
    async renderControlsThreadList(){
        if(!this.controlsSmsThreads) return;
        if(!this.controlThreadList) return;

        this.controlThreadList.innerHTML = "";
        for(const controlSmsThread of this.controlsSmsThreads){
            const smsThreadRender = await controlSmsThread.render();
            smsThreadRender.onclick = e => {
                EventBus.post(new RequestOpenSmsConversation(controlSmsThread.smsThread.address));
            }
            this.controlThreadList.appendChild(smsThreadRender);
        }
    }
    set smsThreads(smsThreads){
        this.controlsSmsThreads = smsThreads.map(smsthread=>{
            return new ControlSMSThread(smsthread);
        });
        this.renderControlsThreadList();
    }
    set message(value){
        if(value){
            UtilDOM.hide(this.controlThreadList)
            UtilDOM.show(this.controlGlobalMessage)
            this.controlGlobalMessage.innerHTML = value;
        }else{
            UtilDOM.hide(this.controlGlobalMessage)
            UtilDOM.show(this.controlThreadList)
            this.controlGlobalMessage.innerHTML = "";
        }
    }
    clearMessage(){
        this.message = null;
    }
}
export class ControlSMSThread extends Control{
    constructor(smsThread){
        super();
        this.smsThread = smsThread;
    }
    getHtmlFile(){
        return "./v2/sms/thread/smsthread.html";
    }
    getStyleFile(){
        return "./v2/sms/thread/smsthread.css";
    }
       
    async renderSpecific({root}){      
        this.contactPictureElement = await this.$(".smscontactpicture");
        this.contactPictureImageElement = this.contactPictureElement.querySelector("img");
        this.contactPictureUnknownElement = this.contactPictureElement.querySelector("svg");
        this.contactNameElement = await this.$(".smscontactname");
        this.textElement = await this.$(".smscontacttext");
        this.dateElement = await this.$(".smscontactdate");
        this.callElement = await this.$(".smscontactcall");
        

        const picture = this.smsThread.contactPicture;
        if(picture){
            this.contactPictureImageElement.src = picture;
            UtilDOM.show(this.contactPictureImageElement);
            UtilDOM.hide(this.contactPictureUnknownElement);
        }else{
            UtilDOM.show(this.contactPictureUnknownElement);
            UtilDOM.hide(this.contactPictureImageElement);
        }
        this.contactNameElement.innerHTML = this.smsThread.contactName;
        this.textElement.innerHTML = this.smsThread.text;
        this.dateElement.innerHTML = this.smsThread.date.formatDate({full:true})
        this.callElement.onclick = async e => {
            e.stopPropagation();
            await EventBus.post(new RequestCall(this.smsThread.address));
        }
    }
}
class RequestOpenSmsConversation{
    constructor(address){
        this.address = address;
    }
}
class RequestCall{
    constructor(address){
        this.address = address;
    }
}