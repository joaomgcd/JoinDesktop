import { Control } from "../../control.js"
import { UtilDOM } from "../../utildom.js";
import { EventBus } from "../../eventbus.js";
import { SMSConversation } from "./smsconversation.js";

export class ControlSMSConversation extends Control{ 
    constructor(){
        super();
    }  
    getHtmlFile(){
        return "./v2/sms/conversation/smsconversation.html";
    }    
    getStyleFile(){
        return "./v2/sms/conversation/smsconversation.css";
    }
       
    async renderSpecific({root}){      
        this.containerElement = root;
        this.messageListElement = await this.$("#smsconversation");
        this.sendButtonElement = await this.$("#smssend");
        // this.titleContainerElement = await this.$("#smstitlecontainer");
        // this.contactPictureElement = await this.$("#contactpictureconversation");
        // this.titleElement = await this.$("#smstitle");
        this.inputElement = await this.$("#smsinput");
        this.subjectElement = await this.$("#smssubject");
        this.urgentElement = await this.$("#smsurgent");
        this.attachmentElement = await this.$("#smsattachment");
        this.fileElement = await this.$("#smsattachmentfile");
        this.attachmentPreviewElement = await this.$("#smsattachmentimagepreview");
        this.attachmentPreviewImageElement = await this.$("#smsattachmentimagepreviewimage");
        this.attachmentPreviewDeleteElement = await this.$("#smsattachmentimagepreviewdelete");
        this.mmsExtrasElement = await this.$("#mmsextras");

        this.attachmentPreviewDeleteElement.onclick = async e => { 
            e.stopPropagation();     
            await this.clearMMSAttachment();
        }
        this.attachmentElement.onclick = () => this.fileElement.click();
        this.fileElement.onchange = async () => {
            const files = this.fileElement.files;
            if(!files || files.length == 0) return;

            await this.loadAttachmentFile(files[0]);
        }
        this.inputElement.onpaste = async e => {
            const items = e.clipboardData.items;
            if(!items) return;

            const currentValue = this.inputElement.value;
            const pastedFile = Array.from(items).map(item=>item.getAsFile()).find(file=>file ? true : false);       
            if(!pastedFile) return;
                 
            await this.loadAttachmentFile(pastedFile);
            this.inputElement.value = currentValue;
        }
        await this.renderCurrentSmsConversation();
    }
    async loadAttachmentFile(file){
        UtilDOM.show(this.attachmentPreviewElement);
        this.attachmentPreviewImageElement.src = await UtilDOM.readPickedFile(file);
        this.attachmentFile = file;
    }
    /**
     * 
     * @param {SMSConversation} smsConversation 
     */
    async setSmsConversation(smsConversation){  
        this.smsConversation = smsConversation;      
        let lastControl = null;
        let multipleReceivedCount = 0;
        this.controlsSmsMessages = smsConversation.map(smsMessage=>{
            if(!smsMessage.received){
                multipleReceivedCount = 0;
            }else{
                multipleReceivedCount++;
            }
            let multipleReceived = false;
            if(lastControl && lastControl.smsMessage.received && smsMessage.received){
                multipleReceived = true;
                lastControl.isLastMultiple = false;
                lastControl.multipleReceived = multipleReceived;
            }
            lastControl = new ControlSMSMessage(smsMessage);
            lastControl.isLastMultiple = lastControl.smsMessage.received;
            lastControl.multipleReceived = multipleReceived;
            lastControl.isFirstMultiple = multipleReceivedCount == 1;
            return lastControl;
        })
        await this.renderCurrentSmsConversation();
    }
    async addSmsMessage(smsMessage){
        this.smsConversation.addSmsMessage(smsMessage);
        await this.setSmsConversation(this.smsConversation);
    }
    async clearMMSAttachment(){        
        this.attachmentFile = null;
        this.attachmentPreviewImageElement.src = "";      
        UtilDOM.hide(this.attachmentPreviewElement);
    }
    async clearCurrentSmsConversation(){
        if(!this.controlsSmsMessages) return;
        
        this.messageListElement.innerHTML = "";
    }
    async renderCurrentSmsConversation(){
        if(!this.controlsSmsMessages) return;
        
        this.clearCurrentSmsConversation();
        for(const controlSmsMessage of this.controlsSmsMessages){
            const render = await controlSmsMessage.render();
            this.messageListElement.appendChild(render);
        }

        // this.titleContainerElement.onclick = async () => {
        //     await EventBus.post(new RequestOpenSmsThreads());
        // }
        // this.titleElement.innerHTML = this.smsConversation.contact.name;
        // const contactPhoto = this.smsConversation.contact.photo;
        // if(contactPhoto){
        //     this.contactPictureElement.src = contactPhoto;
        // }else{
        //     UtilDOM.hide(this.contactPictureElement);
        // }

        this.inputElement.placeholder = `Send message to ${this.smsConversation.contact.address}`;
        this.listenToEnterKey();
        UtilDOM.onclickandlongclick(this.sendButtonElement, async ()=> await this.sendSms(), async () => UtilDOM.toggleShow(this.mmsExtrasElement))


        Util.sleepUntil(100,10000,()=>{
            return !this.containerElement.classList.contains("hidden");
        }).then(()=>{
            this.scrollToBottom();
            this.focusOnInput();
        });
    }
    focusOnInput(){
        if(!this.inputElement) return;

        this.inputElement.focus();
    }
    scrollToBottom(){
        this.messageListElement.scrollTop = this.messageListElement.scrollHeight;
    }
    async sendSms(){
        const text = this.inputElement.value;
        const attachment = this.attachmentFile;
        const subject = this.subjectElement.value;
        const urgent = this.urgentElement.checked;
        this.inputElement.value = "";
        this.subjectElement.value = "";
        this.urgentElement.checked = false;
        await this.clearMMSAttachment();
        await EventBus.post(new RequestSendSMS({contact:this.smsConversation.contact, text, attachment, subject, urgent}))
        this.focusOnInput();
    }
    listenToEnterKey(){
        //have to remove and add otherwise multiple could be added
        if(!this.inputElementKeyDown){
            this.inputElementKeyDown = async e => {
                if(e.keyCode != 13 || e.shiftKey) return;
                
                e.preventDefault();
                await this.sendSms();
            };
        }
        this.inputElement.removeEventListener("keydown",this.inputElementKeyDown);
        this.inputElement.addEventListener("keydown",this.inputElementKeyDown);
    }
}
export class ControlSMSMessage extends Control{
    constructor(smsMessage){
        super();
        this.smsMessage = smsMessage;
    }
    getHtmlFile(){
        return "./v2/sms/conversation/smsmessage.html";
    }
    getStyleFile(){
        return "./v2/sms/conversation/smsmessage.css";
    }
       
    async renderSpecific({root}){ 
        this.containerElement = root; 
        this.messageElement = await this.$(".smsmessage");
        this.senderElement = await this.$(".smsmessagesender");
        this.senderPictureContainerElement = await this.$(".smssenderpicturecontainer");
        this.senderPictureElement = await this.$(".smssenderpicture");
        this.textElement = await this.$(".smsmessagetext");
        this.dateElement = await this.$(".smsmessagedate");
        this.progressElement = await this.$(".smsmessageprogress");
        
        /* MMS Stuff */
        this.attachmentElement = await this.$(".smsmessageattachment");
        this.urgentElement = await this.$(".smsmessageurgent");
        this.subjectElement = await this.$(".smsmessagesubject");

        const received = this.smsMessage.received;
        const sent = !received;
        UtilDOM.hide(this.progressElement);

        const isMMS = this.smsMessage.isMMS;
        UtilDOM.showOrHide(this.attachmentElement,isMMS);
        UtilDOM.showOrHide(this.urgentElement,isMMS);
        UtilDOM.showOrHide(this.subjectElement,isMMS);
        UtilDOM.addOrRemoveClass(this.senderPictureContainerElement,!this.isLastMultiple,"invisible");
        UtilDOM.addOrRemoveClass(this.containerElement,this.isLastMultiple && this.multipleReceived,"lastofmultiple");
        UtilDOM.addOrRemoveClass(this.containerElement,!this.isLastMultiple && this.multipleReceived,"oneofmultiple");
        UtilDOM.addOrRemoveClass(this.containerElement, this.isFirstMultiple && received ,"firstofmultiple");
        if(received){
            this.senderPictureElement.src = this.smsMessage.contact.photo;
        }
        
        this.senderElement.innerHTML = received ?  this.smsMessage.contact.name :  "You" ;
        UtilDOM.hide(this.senderElement);

        this.textElement.innerHTML = this.smsMessage.text;
        this.dateElement.innerHTML = this.smsMessage.date.formatDate({full:true});
        UtilDOM.addOrRemoveClass(this.containerElement,received,"received");
        UtilDOM.addOrRemoveClass(this.containerElement,sent,"sent");
        UtilDOM.showOrHide(this.progressElement,this.smsMessage.isLoading);
    }
}
class RequestOpenSmsThreads{}
class RequestSendSMS{
    constructor({contact,text,attachment,subject,urgent}){
        this.contact = contact;
        this.text = text;
        this.attachment = attachment;
        this.subject = subject;
        this.urgent = urgent;
    }
}