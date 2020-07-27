import { Control } from "../control.js";
import { ControlMediaHeader } from "./controlmediaheader.js";
import { EventBus } from "../eventbus.js";
import { UtilDOM } from "../utildom.js";
import { MediaInfos } from "./mediainfo.js";

export class ControlMediaInfos extends Control{ 
    constructor(mediaInfoLists,tokenGetter){
        super();
        this.tokenGetter = tokenGetter;
        this.mediaInfoLists = mediaInfoLists;
        EventBus.register(this);
    }      
    set mediaInfoLists(mediaInfos){
        this._mediaInfos = mediaInfos;
    }
    get mediaInfoLists(){
        return this._mediaInfos;
    }
    getHtmlFile(){
        return "./v2/media/mediainfos.html";
    }    
    getStyleFile(){
        return "./v2/media/mediainfos.css";
    }
    findMediaInfoControls(mediaInfoOrInfos){
        mediaInfoOrInfos = mediaInfoOrInfos.asMediaInfos;
        return this.controlsMediaInfos.find(controlMediaInfoDevice=>controlMediaInfoDevice.mediaInfos.matches(mediaInfoOrInfos));
    }
    async updateMediaInfos(mediaInfos){
        let controlMediaInfoDevice = this.findMediaInfoControls(mediaInfos);
        if(!controlMediaInfoDevice){
            mediaInfos = new MediaInfos(mediaInfos,mediaInfos.device);
            this.mediaInfoLists.push(mediaInfos);
            // controlMediaInfoDevice = new ControlMediaInfoDevice(mediaInfos,this.tokenGetter);
            // this.controlsMediaInfos.push(controlMediaInfoDevice);
            await this.render();
        }else{
            await controlMediaInfoDevice.updateMediaInfos(mediaInfos);
        }
    }
    async updateMediaInfo(mediaInfo){
        await this.updateMediaInfos(mediaInfo.asMediaInfos);
    }
    async togglePlay(mediaInfo){
        const controlMediaInfos = this.findMediaInfoControls(mediaInfo);
        if(!controlMediaInfos) return;

        await controlMediaInfos.togglePlay(mediaInfo);
    }
    isEmpty(){
        if(!this.mediaInfoLists || this.mediaInfoLists.length == 0) return true;

        const nonEmptyMediaInfos = this.mediaInfoLists.find(mediaInfos => mediaInfos.length != 0);
        return nonEmptyMediaInfos ? false : true;
    }
    async renderSpecific({root}){      
        this.mediaInfosElement = await this.$(".mediainfos");
        this.noMediaInfosElement = await this.$(".nomediainfos");

        this.mediaInfosElement.innerHTML = "";
        if(this.isEmpty()){
            UtilDOM.show(this.noMediaInfosElement);
        }else{
            this.controlsMediaInfos = [];
            UtilDOM.hide(this.noMediaInfosElement);            
            for(const mediaInfos of this.mediaInfoLists){
                if(!mediaInfos || mediaInfos.length == 0) continue;

                const controlMediaInfoDevice = new ControlMediaInfoDevice(mediaInfos,this.tokenGetter);
                const render = await controlMediaInfoDevice.render();
                this.mediaInfosElement.appendChild(render);
                this.controlsMediaInfos.push(controlMediaInfoDevice);

            }
        }
    }
    async unload(){
        await super.unload();

        if(!this.controlsMediaInfos) return;
        
        await Promise.all(this.controlsMediaInfos.map(control=>control.unload()))
    }
   
}

export class ControlMediaInfoDevice extends Control{ 
    constructor(mediaInfos,tokenGetter){
        super();
        this.tokenGetter = tokenGetter;
        this.mediaInfos = mediaInfos;
        EventBus.register(this);
    }      
    set mediaInfos(mediaInfos){
        this._mediaInfos = mediaInfos;
    }
    get mediaInfos(){
        return this._mediaInfos;
    }
    getHtmlFile(){
        return "./v2/media/mediainfodevice.html";
    }    
    getStyleFile(){
        return "./v2/media/mediainfodevice.css";
    }
    
    async updateMediaInfos(mediaInfos){
        const latestMediaInfo = await mediaInfos.latest;
        if(!latestMediaInfo) return;
        
        await this.updateMediaInfo(latestMediaInfo);
        /*for(const mediaInfo of mediaInfos){
            await this.updateMediaInfo(mediaInfo);
        }*/
        if(!mediaInfos.extraInfo || !this.controlMediaHeader) return;

        this.controlMediaHeader.extraInfo = mediaInfos.extraInfo;
        await this.controlMediaHeader.render();
    }
    findMediaInfoControl(mediaInfo){
        return this.controlsMediaInfos ? this.controlsMediaInfos.find(controlMediaInfo=>controlMediaInfo.mediaInfo.matches(mediaInfo)) : null;
    }
    async updateMediaInfo(mediaInfo){
        let controlMediaInfo = this.controlsMediaInfos[0];
        // let controlMediaInfo = this.findMediaInfoControl(mediaInfo);
        if(!controlMediaInfo){
            controlMediaInfo = await this.addMediaInfoControl(mediaInfo);
        }else{
            controlMediaInfo.mediaInfo = mediaInfo;
            await controlMediaInfo.render();
        }
    }
    async renderSpecific({root}){      
        this.mediaInfosElement = root;

        this.mediaInfosElement.innerHTML = "";
        this.controlsMediaInfos = [];
        this.controlMediaHeader = new ControlMediaHeader(this.mediaInfos.extraInfo,this.mediaInfos.device);
        const renderHeader = await this.controlMediaHeader.render();                
        this.mediaInfosElement.appendChild(renderHeader);
        const latestMediaInfo = await this.mediaInfos.latest;
        this.addMediaInfoControl(latestMediaInfo);
        // for(const mediaInfo of this.mediaInfos){
        //     await this.addMediaInfoControl(mediaInfo);
        // }
    }
    async addMediaInfoControl(mediaInfo){
        const controlMediaInfo = new ControlMediaInfo(mediaInfo,this.tokenGetter);
        const render = await controlMediaInfo.render();
        this.mediaInfosElement.appendChild(render);
        this.controlsMediaInfos.push(controlMediaInfo);
        return controlMediaInfo;
    }
    async onStartPlaying(startPlaying){
        if(startPlaying.mediaInfo.device.deviceId != this.mediaInfos.device.deviceId) return;

        for(const controlMediaInfo of this.controlsMediaInfos){
            if(!controlMediaInfo.mediaInfo.playing) continue;

            controlMediaInfo.mediaInfo.playing = false
            await controlMediaInfo.managePlayButtons();
        }
    }
    
    async togglePlay(mediaInfo){
        // let controlMediaInfo = this.findMediaInfoControl(mediaInfo);
        
        const controlMediaInfo = this.controlsMediaInfos[0];
        if(!controlMediaInfo) return;
        
        await controlMediaInfo.togglePlay();
    }
   
}
export class ControlMediaInfo extends Control{
    constructor(mediaInfo,tokenGetter){
        super();
        this.mediaInfo = mediaInfo;
        this.tokenGetter = tokenGetter;
    }
    getHtmlFile(){
        return "./v2/media/mediainfo.html";
    }
    getStyleFile(){
        return "./v2/media/mediainfo.css";
    }

    get token(){
        return this.tokenGetter()
    }
    
    async togglePlay(){
        if(this.mediaInfo.playing){
           await this.pressMediaButton("pause",false); 
        }else{            
           await this.pressMediaButton("play",true);
        }
    }
    async managePlayButtons(playing = this.mediaInfo.playing){
        UtilDOM.showOrHide(this.playElement,!playing);
        UtilDOM.showOrHide(this.pauseElement,playing);
    }
    async pressMediaButton(button,playing){
        button = button.substring(0,1).toUpperCase() + button.substring(1);
        await EventBus.post(new MediaButtonPressed({mediaInfo:this.mediaInfo,button}));
        if(playing){
            await EventBus.post(new StartPlaying(this.mediaInfo));
        }
        this.mediaInfo.playing = playing;
        await this.managePlayButtons(playing);
    }
    /**
     * 
     * @param {String} url 
     */
    async getUrlWithToken(url){
        if(!url) return url;

        if(!url.startsWith("http")) return url;

        let joiner = "?";
        if(url.includes("?")){
            joiner = "&";
        }
        return `${url}${joiner}token=${await this.token}`;
    }
    async renderSpecific({root}){ 
        this.mediaInfoElement = root;
        this.iconElement = await this.$(".mediaicon");
        this.appElement = await this.$(".mediaapp");
        this.appSelectorElement = await this.$(".mediaapparrowdown");
        this.deviceElement = await this.$(".mediadevice");
        this.titleElement = await this.$(".mediatitle");
        this.textElement = await this.$(".mediatext");
        this.backElement = await this.$("[button=back]");
        this.nextElement = await this.$("[button=next]");
        this.playElement = await this.$("[button=play]");
        this.pauseElement = await this.$("[button=pause]");
        this.searchElement = await this.$(".mediabutton.search");

        const token = await this.tokenGetter();
        Util.getImageAsBase64(this.mediaInfo.art, token).then(image=>{
            UtilDOM.setImageSourceOrHide(this.iconElement, image || `./images/join.png`);
        }).catch(error=>null);
        UtilDOM.setImageSourceOrHide(this.iconElement, `./images/join.png`);
        this.appElement.innerHTML = this.mediaInfo.appName;
        const selectApp =  async () => await EventBus.post(new MediaAppNamePressed(this.mediaInfo,this.appElement));
        
        this.appElement.onclick = async () => await selectApp();
        this.appSelectorElement.onclick = async () => await selectApp();
        this.deviceElement.innerHTML = this.mediaInfo.device.deviceName;
        this.titleElement.innerHTML = this.mediaInfo.track;
        let artistAndAlbum = this.mediaInfo.artist;
        if(this.mediaInfo.album){
            if(artistAndAlbum){
                artistAndAlbum += " · ";
            }
            artistAndAlbum += this.mediaInfo.album;
        }
        this.textElement.innerHTML = artistAndAlbum;

        await this.managePlayButtons();
        const elementsButtons = this.mediaInfoElement.querySelectorAll("[button]");
        elementsButtons.forEach(elementButton=>{
            elementButton.onclick = async () => await this.pressMediaButton(elementButton.getAttribute("button"),elementButton.getAttribute("playing"));
        });

        this.searchElement.onclick = async () => {
            const currentShortcutHandler = document.onkeydown;
            document.onkeydown = null;
            var bounds = UtilDOM.getElementBounds(this.searchElement);
            const position = {x:bounds.left,y:bounds.top};
            await EventBus.post(new SearchPressed({mediaInfo:this.mediaInfo,position}))
            document.onkeydown = currentShortcutHandler;
        }
    }
}
class StartPlaying{
    constructor(mediaInfo){
        this.mediaInfo = mediaInfo;
    }
}
class MediaButtonPressed{
    constructor({mediaInfo,button}){
        this.mediaInfo = mediaInfo;
        this.button = button;
    }
}
class SearchPressed{    
    constructor({mediaInfo,position}){
        this.mediaInfo = mediaInfo;
        this.position = position;
    }
}
class MediaAppNamePressed{    
    constructor(mediaInfo,position){
        this.mediaInfo = mediaInfo;
        this.position = position;
    }
}