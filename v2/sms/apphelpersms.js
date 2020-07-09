import { App } from "../app.js";
import { EventBus } from "../eventbus.js";
import { UtilDOM } from '../utildom.js';
import { ControlSMSThreads } from "./thread/controlsmsthread.js";
import { ControlTop } from '../top/controltop.js';
import { SMSThreads, SMSThread } from "./thread/smsthread.js";
import { Device } from "../device/device.js";
import { ControlSMSConversation } from "./conversation/controlsmsconveration.js";
import { DBSMSThreads, DBSMSConversations } from "./dbsms.js";
import { Contacts } from "./contacts.js";
import { ControlDevice, ControlDevices } from "../device/controldevice.js";
import { GCMNewSmsReceived } from "../gcm/gcmapp.js";
import { SMSMessage } from "./conversation/smsconversation.js";
import { AppHelperBase } from "../apphelperbase.js";
import { FAB } from "../fab/fab.js";

const MODE_THREADS = 0;
const MODE_CONVERSATION = 1;
const MODE_CONTACT_SEARCH_SMS = 2;
const MODE_CONTACT_SEARCH_CALL = 3;

/**@type {App} */
let app = null;
export class AppHelperSMS extends AppHelperBase{
    /**
     * 
     * @param {App} app 
     */
    constructor(args = {app,device,address}){
        super(args.app);
        app = args.app;
        this.device = args.device;
        this.deviceId = this.device.deviceId;
        this.address = args.address;
        EventBus.register(this);  
    }
    /** @type {ControlTop} */
    get controlTop(){
        return app.controlTop;
    }
    async load(){
        window.onpopstate = async () => await this.setModeDependingOnUrl(true);
        
        app.controlTop.shouldAlwaysShowImageRefresh = false;
        this.dbSmsThreads = new DBSMSThreads(app.db);
        this.dbSmsConversations = new DBSMSConversations(app.db);
        const token = await app.getAuthToken();
        /** @type {Device} */
        console.log(`Handling SMS for ${this.device.deviceName}`);

        this.db = await app.db;
        //await this.controlTop.setMessage(this.device.deviceName);
        //await this.controlTop.hideMessage();
//        Util.import("../utilweb.js");
        this.controlSmsThreads = new ControlSMSThreads();
        await app.addElement(this.controlSmsThreads);

        this.controlSmsConversation = new ControlSMSConversation();
        await app.addElement(this.controlSmsConversation);
        UtilDOM.hide(this.controlSmsConversation);

        await app.loadFcmClient();
        this.contacts = await this.device.loadContacts(await this.getDbGoogleDriveBaseArgs());
        await this.setMode({address:this.address,byBrowser:false});
    }
    async setModeDependingOnUrl(byBrowser){
        const address = Util.getQueryParameterValue("address");
        await this.setMode({address,byBrowser});
    }
    async setMode({address,byBrowser,manualMode}){
        this.mode = manualMode ? manualMode : (address ? MODE_CONVERSATION : MODE_THREADS);
        if(this.mode == MODE_THREADS){
            await this.switchToThreads(byBrowser);
        }else if(this.mode == MODE_CONTACT_SEARCH_SMS || this.mode == MODE_CONTACT_SEARCH_CALL){
            await this.switchToContactSearch(byBrowser);
        }else{
            await this.switchToConversation(address,byBrowser);
        }
    }
    updateUrl(){
        var url = `?sms=${this.deviceId}`;
        if(this.contact){
            url+= `&address=${encodeURIComponent(this.contact.address)}`;
        }
        Util.changeUrl(url);
    }
    async switchToThreads(byBrowser){
        if(this.mode != MODE_THREADS) return;

        try{
            UtilDOM.hide(this.controlSmsConversation);       
            UtilDOM.show(this.controlSmsThreads);
            this.controlTop.appName = `${this.device.deviceName} SMS`;
            app.controlTop.appNameClickable = true;
            this.controlTop.loading = true;
            this.controlTop.showMenu();
            this.controlTop.iconImage = null;
            this.contact = null;
            if(!byBrowser){
                this.updateUrl();
            }
            this.controlSmsThreads.message = "Loading SMS..."
            //first show stored threads
            await this.renderSmsThreads();

            if(this.mode != MODE_THREADS) return;
            //then refresh from Google Drive 
            const fromGoogleDrive = await this.device.loadSMSThreads(await this.getDbGoogleDriveBaseArgs({refresh:true}));
            if(this.mode != MODE_THREADS) return;

            await this.renderSmsThreads(fromGoogleDrive);  

            this.controlTop.loading = false;
        }catch(error){
            console.error(error);
            this.controlSmsThreads.message = `Couldn't load sms from your Google Drive (${error})`;
            // const response = await this.device.sendSMSThreadsRequest();
            // console.log("SMS History response",response);
        }
        await this.controlSmsThreads.render();
    }

    async switchToConversation(address,byBrowser){
        if(this.mode != MODE_CONVERSATION) return;

        await this.controlSmsConversation.clearCurrentSmsConversation();
        UtilDOM.hide(this.controlContactSearch); 
        UtilDOM.hide(this.controlSmsThreads);
        UtilDOM.show(this.controlSmsConversation); 
        this.controlTop.showBack();
        this.contact = this.contacts.get(address);
        this.controlTop.loading = true;
        this.controlTop.appName = this.contact.name;
        this.controlTop.iconImage = this.contact.photo;
        if(this.contact.photo){
            this.controlTop.hideHomeImage()
        }else{
            this.controlTop.showHomeImage()
        }

        if(!byBrowser){
            this.updateUrl();
        }

        const args = await this.getDbGoogleDriveBaseArgs({address});
        await this.controlSmsConversation.setSmsConversation(await this.device.loadSmsConversation(args));       

        await this.reloadConversationFromNetwork(address);
    }
    async reloadConversationFromNetwork(address){
        this.controlTop.loading = true;
        const args = await this.getDbGoogleDriveBaseArgs({address,refresh:true});
        await this.controlSmsConversation.setSmsConversation(await this.device.loadSmsConversation(args));
        this.controlTop.loading = false;
        await this.controlTop.hideMessage();
    }
    async renderSmsThreads(smsThreads = null){
        if(this.mode != MODE_THREADS) return;

        UtilDOM.hide(this.controlContactSearch); 
        UtilDOM.hide(this.controlSmsConversation);
        if(!smsThreads){
            smsThreads = await this.device.loadSMSThreads(await this.dbGoogleDriveBaseArgs);
        }
        this.controlSmsThreads.smsThreads = smsThreads;
        this.controlSmsThreads.clearMessage();          
        UtilDOM.show(this.controlSmsThreads);
    }

    get dbGoogleDriveBaseArgs(){
        return (async () => {
            return {db:app.db,token:await app.getAuthToken(),deviceId:this.deviceId,contact:this.contact};
        })();
    }
    async getDbGoogleDriveBaseArgs(additional){
       const args = await this.dbGoogleDriveBaseArgs;
       Object.assign(args,additional);
       return args;
    }
    async onAppDeviceSelected(appDeviceSelected){
        const device = appDeviceSelected.device;
        
        this.device = device;
        this.deviceId = this.device.deviceId;
        this.address = null;
        await this.setMode({byBrowser:false});
    }
    async onRequestGoBack(request){
        this.setMode({});
    }
    async onRequestOpenSmsThreads(request){
        this.setMode({});
    }
    async onRequestOpenSmsConversation(request){
        const address = request.address;
        if(!address) return;

        this.setMode({address});   

    }

    async onSMSThreads(smsThreads){
        this.renderSmsThreads(smsThreads);
    }


    async switchToContactSearch(){
        if(this.mode != MODE_CONTACT_SEARCH_SMS && this.mode != MODE_CONTACT_SEARCH_CALL) return;

        UtilDOM.hide(this.controlSmsThreads);
        UtilDOM.hide(this.controlSmsConversation); 
        if(!this.controlContactSearch){
            const ControlContactSearch = (await import("./controlcontactsearch.js")).ControlContactSearch;
            this.controlContactSearch = new ControlContactSearch(this.contacts);
            await app.addElement(this.controlContactSearch);
        }
        UtilDOM.show(this.controlContactSearch); 
        this.controlTop.showBack();
    }
    async onFAB(fab){
        if(fab.id == FAB.sms.id){
            this.setMode({manualMode:MODE_CONTACT_SEARCH_SMS});
        }else if(fab.id == FAB.call.id){
            this.setMode({manualMode:MODE_CONTACT_SEARCH_CALL});
        }
    }
    async callContact(contact){
        const confirmed = confirm(`This will call ${contact.name} (${contact.number}) on your device. Are you sure?`);
        if(!confirmed) return false;

        await this.device.call(contact.number);
        return true;
    }
    async onSelectedContact(selectedContact){
        const contact = selectedContact.contact;
        if(!contact) return;

        if(this.mode == MODE_CONTACT_SEARCH_SMS){
            await this.setMode({address:contact.number});
        }else if(this.mode == MODE_CONTACT_SEARCH_CALL)
        {
            const result = await this.callContact(contact);
            if(!result) return;

            await this.setMode({});
        }
    }
    async onRequestCall(request){
        const contact = this.contacts.get(request.address);
        if(!contact) return;

        await this.callContact(contact);
    }
    async onContacts(contacts){
    }
    /**
     * 
     * @param {GCMNewSmsReceived} gcm 
     */
    async onGCMNewSmsReceived(gcm){
        //SHOW NEW SMS
        if(this.deviceId != gcm.senderId) return;

        console.log("New SMS!",gcm);
        const contacts = await this.device.loadContacts(await this.dbGoogleDriveBaseArgs);
        const contact = contacts.get(gcm.number);
        
        const smsThread = new SMSThread(contact,gcm,this.deviceId);
        await this.dbSmsThreads.updateSingle(smsThread);
        await this.renderSmsThreads();
    }

    async onRequestSendSMS(request){
        console.log("Sending SMS!",request);
        const senderId = await this.senderId;
        const address = request.contact.address;
        const text = request.text;
        let attachment = request.attachment;
        const smsMessage = new SMSMessage({address,text,mmsfile:attachment,mmssubject:request.subject,mmsurgent:request.urgent});
        smsMessage.isLoading = true;

        await this.controlSmsConversation.addSmsMessage(smsMessage);
        await this.dbSmsConversations.updateAll(this.deviceId, this.controlSmsConversation.smsConversation);

        const result = await this.device.sendSMS({senderId,smsMessage,token:await app.getAuthToken()});
        console.log("SMS Send result",result);
        const message = result.success ? "SMS Sent!" : `Couldn't send SMS: ${result.errorMessage}`;
        const timeToast = result.success ? 2000 : 5000;
        app.showToast({text:message,isError:!result.success,time:timeToast});

        if(result.success){
            smsMessage.isLoading = false;
            await this.controlSmsConversation.render();
        }else{
            await this.reloadConversationFromNetwork(address);
        }
        
    }
    get senderId(){
        return (async ()=>(await this.AppContext).context.getMyDeviceId())();
    }
    get AppContext(){
        return (async ()=>(await import('../appcontext.js')).AppContext)();
    }
    async onGCMRespondFile(gcm){
        await this.setModeDependingOnUrl(false);
    }
}