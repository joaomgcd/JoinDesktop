import { AppHelperBase } from "../apphelperbase.js";
import { EventBus } from "../eventbus.js";
import { ControlMediaInfos } from "./controlmediainfo.js";
import { MediaInfo, MediaInfos } from "./mediainfo.js";
import { DBMediaInfos } from "./dbmediainfo.js";
import { GCMRequestFile } from "../gcm/gcmapp.js";
import { ControlDialogSingleChoice } from "../dialog/controldialog.js";

const keyLastControlledMediaInfo = "lastcontrolledmediainfo";
/**@type {App} */
let app = null;
export class AppHelperMedia extends AppHelperBase{
 /**
     * 
     * @param {App} app 
     */
    constructor(args = {app}){
        super(args.app);
        app = args.app;
        EventBus.register(this);  
    }
    
    async load(){
        document.onkeydown = async e => {
            const configuredKeys = app.configuredKeyboardShortcutKeys;
            for(const {key,action} of configuredKeys){
                if(key == e.key){
                    e.preventDefault();

                    const mediaInfo = await this.mediaInfoToControlWithKeyboard;
                    await action(this,mediaInfo);
                    return;
                }
            }
        }
        app.controlTop.appName = `Join Media`;
        app.controlTop.appNameClickable = false;
        this.dbMedia = new DBMediaInfos(app.db);

        this.controlMediaInfos = new ControlMediaInfos(await this.getMediaInfos(false),()=>app.getAuthToken());
        await app.addElement(this.controlMediaInfos);

        app.controlTop.shouldAlwaysShowImageRefresh = true;
        await app.loadFcmClient()

        await this.refreshMedia()
    }
    get isPanel(){
        return true;
    }
    async togglePlay(mediaInfo){
        this.controlMediaInfos.togglePlay(mediaInfo);
    }
    async unload(){
        await super.unload();
        document.onkeydown = null;
    }
    async refreshMedia(){        
        app.controlTop.loading = true;
        try{
            await this.getMediaInfos(true)
            // this.controlMediaInfos.mediaInfoLists = await this.getMediaInfos(true)
            // await this.controlMediaInfos.render()
        }finally{
            app.controlTop.loading = false;
        }
    }
    getMediaInfos(refresh){
        return (async ()=>{
            const devices = (await app.devicesFromDb).filter(device=>device.canBeMediaControlled());
            const token = await app.getAuthToken();
            const db = app.db;
            let mediaInfosLists = await Promise.all(devices.map(async device=>{
                const mediaInfos = await device.loadMediaInfos({db,token,refresh});
                if(!mediaInfos) return new MediaInfos([],device);
                
                this.updateMediaInfos(mediaInfos);
                // for(const mediaInfo of mediaInfos){
                //     await this.updateMediaInfo(mediaInfo);
                // }
                // await this.dbMedia.updateAll(device.deviceId,mediaInfos);
                return mediaInfos;
            }));
            return mediaInfosLists;
        })();        
    }
    updateUrl(){
        Util.changeUrl("/?media");
    }
    async onRequestRefresh(){
        await this.refreshMedia();
    }
    /** @type {MediaInfo?} */
    get mediaInfoToControlWithKeyboard(){
        return (async ()=>{
            const restored = app.restoreObject(keyLastControlledMediaInfo);
            const Device = (await import("../device/device.js")).Device;
            const device = Device.getDevice(restored.device);
            return new MediaInfo(restored,device);
        })();
    }
    set mediaInfoToControlWithKeyboard(mediaInfo){
        app.storeObject(keyLastControlledMediaInfo,mediaInfo);
    }
    async onMediaButtonPressed(mediaButtonPressed){
        const button = mediaButtonPressed.button;
        const mediaInfo = mediaButtonPressed.mediaInfo;
        const device = mediaButtonPressed.mediaInfo.device;
        this.mediaInfoToControlWithKeyboard = mediaInfo;
        await device[`press${button}`](mediaInfo.packageName);
    }
    async onSearchPressed(searchPressed){
        const mediaInfo = searchPressed.mediaInfo;
        const device = searchPressed.mediaInfo.device;

        const ControlDialogInput = (await import("../dialog/controldialog.js")).ControlDialogInput;
        const text = await ControlDialogInput.showAndWait({title:`What do you want to play in ${mediaInfo.appName} on your ${device.deviceName}?`,placeholder:"Song, Artist, Album or Playlist",position:searchPressed.position});
        if(!text) return;

        await device.searchAndPlayMedia({packageName:mediaInfo.packageName,query:text});
        const warnedUserAppsNotPlayingKey = "warnuserappsnotplaying";
        if(!app.restoreBoolean(warnedUserAppsNotPlayingKey)){
            await alert("Warning:  Join asks the app to automatically start playing but some apps simply don't do it. Unfortunately that's beyond Join's control.");
            app.store(warnedUserAppsNotPlayingKey,true);
        }
    }
    async onMediaVolumeChanged(mediaVolumeChanged){
        const device = mediaVolumeChanged.device;
        const volume = mediaVolumeChanged.volume;
        await device.setMediaVolume(volume);
    }
    async onGCMMediaInfo(gcm){
        const device = await app.getDevice(gcm.senderId);
        const mediaInfo = new MediaInfo(gcm,device);
        await this.updateMediaInfo(mediaInfo);
    }
    async updateMediaInfos(mediaInfos){
        if(!this.controlMediaInfos) return;
        
        // const device = mediaInfos.device;
        // await mediaInfos.convertArtToBase64(await app.getAuthToken());
        await this.controlMediaInfos.updateMediaInfos(mediaInfos);
    }
    async updateMediaInfo(mediaInfo){
        if(!this.controlMediaInfos) return;
        
        const device = mediaInfo.device;
        await mediaInfo.convertArtToBase64(await app.getAuthToken());
        await this.controlMediaInfos.updateMediaInfo(mediaInfo);
        await this.dbMedia.updateSingle({device,mediaInfo});
    }
    async onGCMRespondFile(gcm){
        const responseFile = gcm.responseFile;
        if(!responseFile) return;

        const request = responseFile.request;
        if(!request) return;

        const requestType = request.requestType;
        if(requestType != GCMRequestFile.TYPE_MEDIA_INFOS) return;

        const fileId = responseFile.fileId;
        if(!fileId) return;

        const device = await app.getDevice(responseFile.senderId);
        if(!device) return;

        let mediaInfosRaw = await app.googleDrive.downloadContent({fileId});
        mediaInfosRaw = await Encryption.decrypt(mediaInfosRaw);
        const mediaInfos = new MediaInfos(mediaInfosRaw,device);
        await mediaInfos.convertArtToBase64(await app.getAuthToken());
        await this.dbMedia.updateAll(device.deviceId,mediaInfos);
        const latest = mediaInfos.latest;
        await this.updateMediaInfo(latest);
    }
    async onMediaAppNamePressed(mediaAppNamePressed){
        const control = this.controlMediaInfos.findMediaInfoControls(mediaAppNamePressed.mediaInfo);
        const position = mediaAppNamePressed.position;
        const selected = await ControlDialogSingleChoice.showAndWait({position,choices:control.mediaInfos,choiceToLabelFunc:mediaInfo=>mediaInfo.appName});
        if(!selected) return;

        selected.date = new Date().getTime();
        this.updateMediaInfo(selected);
    }
}