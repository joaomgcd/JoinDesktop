import { Control } from "../control.js";
import { EventBus } from "../eventbus.js";

export class ControlMediaHeader extends Control{
    /**
     * 
     * @param {*} extraInfo 
     * @param {Device} device 
     */
    constructor(extraInfo,device){
        super();
        this.extraInfo = extraInfo;   
        this.device = device;       
    }
    getHtmlFile(){
        return "./v2/media/mediaheader.html";
    }
    getStyleFile(){
        return "./v2/media/mediaheader.css";
    }

    async renderSpecific({root}){ 
        this.mediaVolumeElement = root;
        this.deviceNameElement = await this.$(".mediadevicename");
        this.rangeElement = await this.$(".mediavolumerange");

        this.deviceNameElement.innerHTML = this.device.deviceName;
        const volume = this.mediaVolume;
        if(volume){
            this.rangeElement.value = volume;
        }
        const maxVolume = this.maxMediaVolume;
        if(maxVolume){
            this.rangeElement.setAttribute("max",maxVolume);
        }
        this.rangeElement.onchange = async () => await EventBus.post(new MediaVolumeChanged(this.device,this.rangeElement.value));
    }

    get mediaVolume(){
        if(this._mediaVolume == null) return this.extraInfo ? this.extraInfo.mediaVolume : null;

        return this._mediaVolume;
    }
    set mediaVolume(value){
        this._mediaVolume = value;
        this.render();
    }

    get maxMediaVolume(){
        if(this._maxMediaVolume == null) return this.extraInfo ? this.extraInfo.maxMediaVolume : null;

        return this._maxMediaVolume;
    }
    set maxMediaVolume(value){
        this._maxMediaVolume = value;
        this.render();
    }
}
class MediaVolumeChanged{
    constructor(device,volume){
        this.device = device;
        this.volume = volume
    }
}