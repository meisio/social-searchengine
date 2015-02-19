

function clean(str){
	if(str !== null && str !== undefined){
		str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"");
		str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,"");
		str = str.replace(/<(?:.|\s)*?>/g, "");
		str = str.replace(/[()?:!.,;{}\"]+/g,"");
		str = str.replace(/[ ]{2,}/g," ");
		str = str.toLowerCase();
		return str;
	} else {
		return "";
	}
}

function isEmpty(e){
	return (e === undefined || e === null || (typeof(e) === "string" && e.length == 0));
}

function getTextSurrounding(word,txt,max){
	if(!max){
		max = 200;
	}

	var idx = txt.indexOf(word);
	if(idx !== -1){
		var res = "";

		res+="...";
		if(idx - 10 > 0 ){
			idx = idx - 10;
		}

		for(var i=idx; i<(idx+max<txt.length?idx+max:txt.length); i++){
			res+=txt[i];
		}

		res+="...";
		return res;
	} else {
		return "";
	}
}

exports.getTextSurrounding = getTextSurrounding;
exports.cleanHtml = clean;
exports.isEmpty = isEmpty;