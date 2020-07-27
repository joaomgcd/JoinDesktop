let UtilFinal = null;
try{
	UtilFinal = Util
}catch(error){
	try{
		const {Util} = require("./util.js")
		UtilFinal = Util
	}catch{
		console.log(error);
		throw error;
	}
}

Array.prototype.groupBy = function(keyGetter){
	if(!this || this.length == 0) return [];

	return this.reduce(function(rv, x) {
	  	if(!rv.groups){
	  		rv.groups = [];
	  	}
	  	var key = keyGetter(x);
	  	var group = rv.groups.find(existing=>existing.key != null && existing.key == key);
	  	if(!group){
	  		group = {};
	  		group.key = key;
	  		group.values = [];
	  		rv.groups.push(group);
	  	}
	  	group.values.push(x);
	    return rv;
	  }, {}).groups;
}
Array.prototype.count = function(filter){
	return this.filter(filter).length;
}
Array.prototype.minBy = function(selector){
	if(this.length == 0) return null;

	let minItem = this[0];
	let min = selector(minItem) || Number.MAX_SAFE_INTEGER;
	for(const item of this){
		const number = selector(item);
		if(number == undefined || number == null) continue;
		
		if(number<min){
			min = number;
			minItem = item;
		}
	}
	return minItem;
} 
Array.prototype.maxBy = function(selector){
	if(this.length == 0) return null;

	let maxItem = this[0];
	let max = selector(maxItem) || Number.MIN_SAFE_INTEGER;
	for(const item of this){
		const number = selector(item);
		if(number == undefined || number == null) continue;
		
		if(number>max){
			max = number;
			maxItem = item;
		}
	}
	return maxItem;
} 
Array.prototype.sortByMultiple = function(invert,...compareFieldFuncs){
    const array = this;
    if(compareFieldFuncs.length == 0){
        array.sort();
    }else{
        var invertIfNeeded = value=> invert ? value * -1 : value;
        array.sort((left,right)=>{
            var comparisonResult = 0;
            for(var compareFieldFunc of compareFieldFuncs){
                var leftValue = compareFieldFunc(left);
                var rightValue = compareFieldFunc(right);
                if(leftValue == null){
                    if(rightValue != null){
                        return invertIfNeeded(1);
                    }
                }					
                if(rightValue == null){
                    if(leftValue != null){
                        return invertIfNeeded(-1);
                    }
                }
                if(rightValue == null && rightValue == null){
                    return 0;
                }
                if(UtilFinal.toClass(leftValue) == UtilFinal.toClass(rightValue)){
                    if(UtilFinal.isString(leftValue)){
                        comparisonResult = leftValue.toLowerCase().localeCompare(rightValue.toLowerCase()) * -1;
                    }else if(UtilFinal.isNumber(leftValue)){
                        comparisonResult =  rightValue - leftValue;
                    }else if(UtilFinal.isBoolean(leftValue)){
                        comparisonResult =  leftValue ? (rightValue ? 0 : -1) : (!rightValue ? 0 : 1);
                    }						
                }
                if(comparisonResult != 0){
                    return invertIfNeeded(comparisonResult);
                }
            }
            return invertIfNeeded(comparisonResult);
        });	
    }
}

Date.prototype.customFormat = function(args = {formatString,twelveHourFormat}){
	var formatString = args.formatString;
	var twelveHourFormat = args.twelveHourFormat;
	if(!formatString){
		formatString = args;
	}
	if(!twelveHourFormat){
		twelveHourFormat = false;
	}
	var YYYY,YY,MMMM,MMM,MM,M,DDDD,DDD,DD,D,hhhh,hhh,hh,h,mm,m,ss,s,ampm,AMPM,dMod,th;
	YY = ((YYYY=this.getFullYear())+"").slice(-2);
	MM = (M=this.getMonth()+1)<10?('0'+M):M;
	MMM = (MMMM=["January","February","March","April","May","June","July","August","September","October","November","December"][M-1]).substring(0,3);
	DD = (D=this.getDate())<10?('0'+D):D;
	DDD = (DDDD=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][this.getDay()]).substring(0,3);
	th=(D>=10&&D<=20)?'th':((dMod=D%10)==1)?'st':(dMod==2)?'nd':(dMod==3)?'rd':'th';
	formatString = formatString.replace("#YYYY#",YYYY).replace("#YY#",YY).replace("#MMMM#",MMMM).replace("#MMM#",MMM).replace("#MM#",MM).replace("#M#",M).replace("#DDDD#",DDDD).replace("#DDD#",DDD).replace("#DD#",DD).replace("#D#",D).replace("#th#",th);
	// CHANGE NOTE: There appeared to be a lot of unused material. I cleaned up some of the code. We can restore it later if it was needed.
	h=this.getHours();
	hh = h;
	if (twelveHourFormat) {
		if (h==0) hh=12;
		if (h>12) hh-=12;
		AMPM=(h<12)?'AM':'PM';
	} else {
		hh = h<10?('0'+h):h;
		AMPM = "";
	}
	mm=(m=this.getMinutes())<10?('0'+m):m;
	ss=(s=this.getSeconds())<10?('0'+s):s;
	return formatString.replace("#hhhh#",hhhh).replace("#hhh#",hhh).replace("#hh#",hh).replace("#h#",h).replace("#mm#",mm).replace("#m#",m).replace("#ss#",ss).replace("#s#",s).replace("#ampm#",ampm).replace("#AMPM#",AMPM);
};
Number.prototype.formatDate = function({full,twelveHourFormat}){
	var date = new Date(this);
	var now = new Date();
	var formatString = "#hh#:#mm#";
	if (twelveHourFormat) {
		formatString = formatString+" #AMPM#";
	}

	if(now.getDate() == date.getDate() && now.getMonth() == date.getMonth() && now.getFullYear() == date.getFullYear()){
		return date.customFormat({formatString,twelveHourFormat});
	}

	var yesterday = new Date(now);
	yesterday.setDate(now.getDate()-1);

	if (full) {
		if(yesterday.getDate() == date.getDate() && yesterday.getMonth() == date.getMonth() && yesterday.getFullYear() == date.getFullYear()){
			return "Yesterday, " + date.customFormat({formatString});
		} else {
			return date.customFormat("#MMM# #DD#, #hh#:#mm# #AMPM#");
		}
	} else {
		if(yesterday.getDate() == date.getDate() && yesterday.getMonth() == date.getMonth() && yesterday.getFullYear() == date.getFullYear()){
			return "Yesterday";
		}
	return date.customFormat("#MMM# #DD#");
	}
}