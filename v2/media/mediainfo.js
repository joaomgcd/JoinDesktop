import { DBGoogleDriveLoader } from "../google/drive/dbgoogledriveloader.js";

class LoaderMediaInfos extends DBGoogleDriveLoader{
    async getDbSpecific(db){
        const DBMediaInfos = (await import("./dbmediainfo.js")).DBMediaInfos;
        return new DBMediaInfos(db);
    }
    async loadFromGoogleDrive(args){
        return await MediaInfos.fromGoogleDrive(args);
    }
    async loadFromLocalNetwork(args){
        const mediaInfos = await MediaInfos.fromLocalNetwork(args);
        if(mediaInfos){
            const latest = await mediaInfos.latest;
            await latest.convertArtToBase64(args.token);
        }
        return mediaInfos;
    }    
    async requestFromGoogleDrive({device}){
        await device.sendMediaInfosRequest();
    }
    get requestNewestVersionInsteadOfLoadingFromGoogleDrive(){
        return true;
    }
}
// export class MediaInfoDevice{
//     constructor(mediaInfos){
//         this.mediaInfos = mediaInfos;
//     }
//     get device(){
//         return this.mediaInfos.device;
//     }
//     get extraInfo(){
//         return this.mediaInfos.extraInfo;
//     }
// }

export class MediaInfos extends Array{
    constructor(initial,device){
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        this.device = device
        if(Util.isArray(initial)){
            initial.mediaInfosForClients = initial;
            const first = initial[0] || {};
            initial.extraInfo = {mediaVolume:first.mediaVolume || 1,maxMediaVolume: first.maxMediaVolume || 15};
        }
        this.extraInfo = initial.extraInfo;
        if(!initial.mediaInfosForClients) return;

        initial.mediaInfosForClients.forEach(mediaInfo=>this.addMediaInfo({mediaInfo,device}));
    }
    static get loader(){
        return new LoaderMediaInfos();
    }
    static async fromGoogleDrive({device,token}){
        const raw = await new GoogleDrive(()=>token).downloadContent({fileName: "media=:=" + device.deviceId});
        
        const mediaInfos = new MediaInfos(raw,device);
        return mediaInfos;
    }
    static async fromLocalNetwork({device,token}){
        const raw = await device.getViaLocalNetwork({path:`media`,token});
        const result = new MediaInfos(raw.payload,device);
        return result;
    }
    getNewOrExisting({mediaInfo,device}){
        if(!Util.isType(mediaInfo,"MediaInfo")){
            mediaInfo = new MediaInfo(mediaInfo,device);
        }else{
            mediaInfo.device = device;
        }
        return mediaInfo;
    }
    addMediaInfo({mediaInfo,device}){
        mediaInfo = this.getNewOrExisting({mediaInfo,device});
        this.push(mediaInfo);
    }
    updateMediaInfo({mediaInfo,device}){
        mediaInfo.device = device;
        const existing = this.find(existing=>existing.matches(mediaInfo));
        if(!existing){
            this.push(this.getNewOrExisting({mediaInfo,device}));
        }else{
            existing.update(mediaInfo);
        }
    }
    matches(otherMediaInfos){
        return this.device.deviceId == otherMediaInfos.device.deviceId
    }
    async convertArtToBase64(token){   
        const conversions = this.map(async mediaInfo=>await mediaInfo.convertArtToBase64(token));
        return await Promise.all(conversions);
    }
    get asMediaInfos(){
        return this;
    }
    /**@type {MediaInfo} */
    get latest(){
        return (async=>{            
            this.sortByMultiple(false,mediaInfo=>{
                if(mediaInfo.playing) return Number.MAX_SAFE_INTEGER;
                
                if(mediaInfo.date) return mediaInfo.date;
                
                return Number.MIN_SAFE_INTEGER;
            })
            return this[0];
        })()
    }
}

export class MediaInfo{
    constructor(mediaInfo,device){
        Object.assign(this,mediaInfo);
        this.device = device;
    }
    matches(otherMediaInfo){
        return this.packageName == otherMediaInfo.packageName && this.device.deviceId == otherMediaInfo.device.deviceId
    }
    update(mediaInfo){
        Object.assign(this,mediaInfo);
    }
    async convertArtToBase64(token){        
        try{
            this.art = await Util.getImageAsBase64(this.art,await token);
            return this.art;
        }catch(error){
            console.log(`Couldn't convert art ${this.art}`,error)
        }
    }
    get asMediaInfos(){
        const mediaInfos = new MediaInfos([this],this.device);
        return mediaInfos;
    }
}