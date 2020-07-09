import { MediaInfos } from "./mediainfo.js";

export class DBMediaInfos{    
    constructor(db){
        this.db = db;
    }
    async updateAll(deviceId,mediaInfos){
        const key = deviceId;
        const json = JSON.stringify(mediaInfos);
        await this.db.mediaInfos.put({key,json});        
    }
    async updateSingle({device,mediaInfo}){
        const key = device.deviceId;
        let mediaInfos = await this.getAll({device});
        if(!mediaInfos){
            mediaInfos = new MediaInfos([],device);
        }
        await mediaInfos.updateMediaInfo({device,mediaInfo});
        const json = JSON.stringify(mediaInfos);
        await this.db.mediaInfos.put({key,json});        
    }
    async getAll({device}){
        const key = device.deviceId;
        const item = await this.db.mediaInfos.get(key);   
        if(!item) return new MediaInfos([],device);
        if(!item.json) return new MediaInfos([],device);
        
        const fromJson = JSON.parse(item.json);
        if(!Util.isArray(fromJson)) return new MediaInfos([],device);

        const mediaInfos = new MediaInfos(fromJson,device);
        return mediaInfos;
    }
}