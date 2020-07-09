import { Control } from "../control.js";
import { SettingTextInput, SettingSingleOption, SettingColor } from "./setting.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";

export class ControlSettings extends Control{
    constructor(settings){
        super();
        this.settings = settings;
    }
    getHtmlFile(){
        return "./v2/settings/settings.html";
    }
    getStyleFile(){
        return "./v2/settings/settings.css";
    }
   
    async renderSpecific({root}){
        this.settingsElement = await this.$(".settings");
        
        this.settingsElement.innerHTML = "";
        this.controlsSettings = [];
        for(const setting of this.settings){
            const controlSetting = new ControlSetting(setting);
            this.controlsSettings.push(controlSetting);
            const render = await controlSetting.render();
            this.settingsElement.appendChild(render);
        }       
    }
    async update(setting){
        const controlSetting = this.controlsSettings.find(controlSetting=>controlSetting.setting.id == setting.id);
        await controlSetting.render();
    }
}
export class ControlSetting extends Control{
    /**
     * 
     * @param {Setting} setting 
     */
    constructor(setting){
        super()
        this.setting = setting;
    }
    getHtmlFile(){
        return "./v2/settings/setting.html";
    }
    getStyleFile(){
        return "./v2/settings/setting.css";
    }
   
    async renderSpecific({root}){
        this.settingElement = root;
        this.settingLabelElement = await this.$(".settinglabel");
        this.settingSubtextElement = await this.$(".settingsubtext");
        this.settingExtratextElement = await this.$(".settingextratext");
        this.settingSetNotSetElement = await this.$(".settingsetnotsettext");
        this.settingSetElement = await this.$(".settingset");
        this.settingNotSetElement = await this.$(".settingnotset");
        this.settingContentElement = await this.$(".settingcontent");
       
        this.settingLabelElement.innerHTML = this.setting.label;

        UtilDOM.showOrHide(this.settingSubtextElement,this.setting.subtext);
        this.settingSubtextElement.innerHTML = this.setting.subtext;
        
        UtilDOM.showOrHide(this.settingExtratextElement,this.setting.extratext);
        this.settingExtratextElement.innerHTML = this.setting.extratext;
        
        UtilDOM.showOrHide(this.settingSetNotSetElement,this.setting.isSecret);
        const value = await this.setting.value;
        UtilDOM.showOrHide(this.settingSetElement,value);
        UtilDOM.showOrHide(this.settingNotSetElement,!value);
        

        this.settingContentElement.innerHTML = "";
        const controlSettingContent = await ControlSetting.getControlSettingContent(this.setting);
        const render = await controlSettingContent.render();
        this.settingContentElement.appendChild(render);
        
    }
    static async getControlSettingContent(setting){
        if(Util.isSubTypeOf(setting,SettingTextInput)){
            return new ControlSettingContentTextInput(setting);
        }
        if(Util.isSubTypeOf(setting,SettingSingleOption)){
            return new ControlSettingContentSingleOption(setting);
        }
        if(Util.isSubTypeOf(setting,SettingColor)){
            return new ControlSettingContentColor(setting);
        }
        let type = Util.getType(setting);
        const typeFromSetting = (await import("./setting.js"))[type].controlType;
        if(typeFromSetting){
            type = typeFromSetting;
        }else{
            type = type.replace("Setting","SettingContent");
            type = `Control${type}`;
        }
        const controlType = eval(type);
        return new controlType(setting);
    }
}
export class ControlSettingContent extends Control{
    
    constructor(setting){
        super()
        this.setting = setting;
    }
}
export class ControlSettingContentTextInput extends ControlSettingContent{
    /**
     * 
     * @param {SettingTextInput} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtmlFile(){
        return "./v2/settings/settingtextinput.html";
    }
    getStyleFile(){
        return "./v2/settings/settingtextinput.css";
    }
   
    async renderSpecific({root}){
        this.settingElement = root;   

        this.placeholderElement = await this.$("label");
        this.inputElement = await this.$("input");
        this.saveButtonElement = await this.$(".save");
        this.resetButtonElement = await this.$(".reset");
        
        UtilDOM.enable(this.saveButtonElement);
        UtilDOM.enable(this.inputElement);
        UtilDOM.enable(this.resetButtonElement);

        UtilDOM.showOrHide(this.resetButtonElement,this.setting.isSecret)
        
        this.placeholderElement.innerHTML = this.setting.placeholder;
        const value = await this.setting.value;
        if(!this.setting.isSecret && value){
            this.inputElement.value = value;
        }else{
            this.inputElement.value = "";
        }
        this.saveButtonElement.onclick = async () => {
            const settingSaved = new SettingSaved(this.setting,this.inputElement.value);
            this.inputElement.value = "";
            this.placeholderElement.innerHTML = "Saving. May take a while...";
            UtilDOM.disable(this.saveButtonElement);
            UtilDOM.disable(this.resetButtonElement);
            UtilDOM.disable(this.inputElement);
            await EventBus.post(settingSaved)
            if(this.setting.isSecret){
                this.placeholderElement.innerHTML = this.setting.placeholder;
                UtilDOM.enable(this.saveButtonElement);
                UtilDOM.enable(this.resetButtonElement);
                UtilDOM.enable(this.inputElement);
            }
        }
        this.resetButtonElement.onclick = async () => await EventBus.post(new SettingSaved(this.setting,null));
    }
}
export class ControlSettingContentSingleOption extends ControlSettingContent{
    /**
     * 
     * @param {SettingSingleOption} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtmlFile(){
        return "./v2/settings/settingsingleoption.html";
    }
    getStyleFile(){
        return "./v2/settings/settingsingleoption.css";
    }
   
    async renderSpecific({root}){
        this.settingElement = root;   

        this.selectElement = await this.$("select");
        this.renderList(this.selectElement,this.setting.options,option=>{
            const optionElement = document.createElement("option");
            optionElement.value = option.id;
            optionElement.innerHTML = option.label;
            return optionElement;
        })
        this.selectElement.value = await this.setting.value;
        this.selectElement.onchange = async () => await EventBus.post(new SettingSaved(this.setting,this.selectElement.value));
    }
}
export class ControlSettingContentColor extends ControlSettingContent{
    /**
     * 
     * @param {SettingSingleOption} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtml(){
        return `<input type="color"></input>`
    }
   
    async renderSpecific({root}){
        this.settingElement = root;   

        this.settingElement.value = await this.setting.value;
        this.settingElement.onchange = async () => await EventBus.post(new SettingSaved(this.setting,this.settingElement.value));
    }
}
class SettingSaved{
    constructor(setting,value){
        this.setting = setting;
        this.value = value;
    }
}