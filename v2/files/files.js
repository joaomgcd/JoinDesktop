import { DBGoogleDriveLoader } from "../google/drive/dbgoogledriveloader.js";

class LoaderNotificationInfos extends DBGoogleDriveLoader{
    async getDbSpecific(db){
        return null;
    }
    async loadFromGoogleDrive(args){
        return await FileList.fromGoogleDrive(args);
    }
    async loadFromLocalNetwork(args){
        return await FileList.fromLocalNetwork(args);
    }    
    async requestFromGoogleDrive(args){
        await args.device.sendFileListRequest(args);
    }
    get requestNewestVersionInsteadOfLoadingFromGoogleDrive(){
        return true;
    }
}

export class FileList{
    constructor({raw,device}){
        if(!raw){
            raw = {};
        }
        this.pathSegments = raw.pathSegments || [];
        this.files = new Files(raw.files || [],device);
    }
    get path(){
        if(this.pathSegments.length == 0) return "/";

        return `/${this.pathSegments.join("/")}/`;
    }
    /**
     * 
     * @param {File} file 
     */
    getPathForFile(file){
        return `${this.path}${file.name}`;
    }
    static async fromGoogleDrive(args){
        const device = args.device;
        return new FileList({raw:{},device});
    }
    static async fromLocalNetwork(args){
        const device = args.device;
        const token = args.token;
        const path = args.path || "";
        const raw = await device.getViaLocalNetwork({path:`folders${path}`,token});
        const result = new FileList({raw:raw.payload,device});
        return result;
    }
    static get loader(){
        return new LoaderNotificationInfos();
    }
}

export class Files extends Array{
    constructor(initial,device){       
        if(Number.isInteger(initial)){
			super(initial);
			return;
		}
        super();
        this.device = device;
        if(!initial || !initial.map){
            initial = [];
        }

		initial.forEach(file=>this.push(new File(file,device)));
    }
}
export class File{
    constructor(file,device){
        this.device = device;
        Object.assign(this,file);
    }
}