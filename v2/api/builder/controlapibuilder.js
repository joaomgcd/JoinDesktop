import { Control } from "../../control.js";
import { ApiFields } from "./apifield.js";
import { ControlApiField } from "./controlapifield.js";
import { Device } from "../../device/device.js";
import { EventBus } from "../../eventbus.js";
import { UtilDOM } from "../../utildom.js";

export class ControlApiBuilder extends Control{

    /**
     * 
     * @param {Device} device 
     */
    constructor(device){
        super()
        EventBus.register(this);
        this.device = device;
        this.apiFields = new ApiFields();
        this.controlsApiFields = this.apiFields.map(apiField=>new ControlApiField(apiField));
    }
    getHtmlFile(){
        return "./v2/api/builder/apibuilder.html";
    }
    getStyleFile(){
        return "./v2/api/builder/apibuilder.css";
    }
    async renderSpecific({root}){
        this.deviceIdElement = await this.$("#deviceid");
        this.apiFieldsElement = await this.$("#apifields");
        this.showApiKeyElement = await this.$("#buttonshowapikey");
        this.apiKeyNoticeElement = await this.$("#apikeynotice");
        this.apiKeyElement = await this.$("#apikey");
        this.apiKeyDeleteElement = await this.$("#buttondeleteapikey");
        this.apiKeyResetElement = await this.$("#buttonresetapikey");

        for(const controlApiField of this.controlsApiFields){
            const apiFieldRender = await controlApiField.render();
            this.apiFieldsElement.appendChild(apiFieldRender);
        }
        this.setGeneratedUrlDefaultValue();
        //update device render
        this.device = this.device;

        this.showApiKeyElement.onclick = async () => await EventBus.post(new RequestShowApiKey());
        this.apiKeyResetElement.onclick = async () => await EventBus.post(new RequestResetApiKey());
        this.apiKeyDeleteElement.onclick = async () => await EventBus.post(new RequestDeleteApiKey());
    }

    onRequestGenerateUrl(){
        if(!this.apiKey) return;

        var url = window.location.origin.replace("8081","8080").replace("file://","https://joinjoaomgcd.appspot.com");
        url = `${url}/_ah/api/messaging/v1/sendPush?apikey=${this.apiKey}`

        var toAppend = "";
        const append = (key,value) =>  toAppend += `&${key}=${encodeURIComponent(value)}`
        this.controlsApiFields.forEach(controlApiField=>{
            const value = controlApiField.value;
            if(!value) return;

            const id = controlApiField.apiField.id;
            if(id == ApiFields.generatedUrlFieldId) return;
            
            append(id,value);
        });
        if(!toAppend.includes("deviceNames")){
            append("deviceId",this.device.deviceId);
        }
        url+=toAppend;
        this.generatedUrlControlApiField.value = url;
    }
    get generatedUrlControlApiField(){
        return this.controlsApiFields.find(controlApiField=>controlApiField.apiField.id == ApiFields.generatedUrlFieldId);
    }
    setGeneratedUrlDefaultValue(){
        this.generatedUrlControlApiField.value = "API Key needed for URL. Please click the button to show the API key above."
    }
    /**
     * 
     * @param {Device} device 
     */
    set device(device){
        this._device = device;
        if(!this.deviceIdElement) return;

        this.deviceIdElement.innerHTML = device.deviceId;
        this.onRequestGenerateUrl();
    }
    /**
     * 
     * @returns {Device}
     */
    get device(){
        return this._device;
    }
    /**
     * 
     * @param {String} apiKey 
     */
    generateUrl(apiKey){
        const hasApiKey = apiKey ? true : false;
        try{
            this.apiKey = apiKey;
            if(!hasApiKey) return;
            

            this.apiKeyElement.innerHTML = apiKey;
            this.onRequestGenerateUrl(); 
        }finally{
            UtilDOM.showOrHide(this.apiKeyNoticeElement,hasApiKey);
            UtilDOM.showOrHide(this.showApiKeyElement,!hasApiKey);
            UtilDOM.showOrHide(this.apiKeyElement,hasApiKey);
            UtilDOM.showOrHide(this.apiKeyDeleteElement,hasApiKey);
            UtilDOM.showOrHide(this.apiKeyResetElement,hasApiKey);
            if(!hasApiKey){
               this.setGeneratedUrlDefaultValue();
            }
        }
    }

}

class RequestShowApiKey{}
class RequestResetApiKey{}
class RequestDeleteApiKey{}