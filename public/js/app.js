$(document).ready(function(){
	function getLocation(href) {
		var location = document.createElement("a");
		location.href = href;
		if (location.host == "") {
			location.href = location.href;
		}
		return location;
	}

	function formatURL(location,words,title){
		var max_chars = 50;

		if(location.href.length > max_chars){
			var url = location.protocol + '://' + location.host + '/';
			var lastidx = url.length-1;
			var path = location.pathname;
			var splitted = path.split('/');

			var matches = false;
			var added = -1;
			for(var i=0; i<splitted.length; i++){
				var p = splitted[i];
				for(var j=0; j<words.length; j++){
					var idx = p.indexOf(words[i]);
					if(idx>-1){
						if(i-added === 0){
							url+=p+'/';
						} else {
							url+='.../'+p;
						}
						added = i;
						matches = true;
						break;
					}
				}
			}

			if(!matches){
				
				// match title
				var title = title.toLowerCase().split(' ');
				for(var i=0; i<splitted.length; i++){
					var p = splitted[i];
					for(var j=0; j<title.length; j++){
						var idx = p.indexOf(title[i]);
						if(idx>-1){
							if(i-added === 0){
								url+=p+'/';
							} else {
								url+='.../'+p;
							}
							added = i;
							matches = true;
							break;
						}
					}
				}
			}

			if(!matches){
				var length = max_chars-url.length;
				for(var i=1; i<path.length; i++){
					if(length == 0){
						break;
					}

					url+=path[i];

					length--;
				}
			}
			
			return url;
		} else {
			return location.href;
		}
	}

	function render_web_results(data,searchterms){
		var $div = $("#search_results");
		var count = data.web_count!==undefined?data.web_count:0;
		//$("#search_result_count").html("About " + count + " results");
		$div.html('');
		if(data.length == 0){
			$div.html('Sorry no results');
		//	_app.view.render_web_results_empty();
			return;
		}


		/*
			<li>
               <span class="result-title">Title</span><br>
               <span class="result-url">http://url.com</span><br>
               <div class="result-description">description</div>
             </li>
		 */
		//this.set_pagination_visible(true);

		for (var i = 0; i < data.length; i++) {
			var location = getLocation(data[i]._id);
			var a = data[i]._id;
			var elem = $('<div class="row valign-wrapper"></div>');
			
			var title = data[i].title!==null?data[i].title:'';
			var url = formatURL(location,searchterms,title);//data[i]._id;
			var description = data[i].description!==null?data[i].description:'';

			for(var j=0; j<searchterms.length; j++){
				var re = new RegExp(searchterms[j],"gi");
				title = title.replace(re, '<strong>'+searchterms[j]+'</strong>');
				url = url.replace(re, '<strong>'+searchterms[j]+'</strong>');
				description = description.replace(re, '<strong>'+searchterms[j]+'</strong>');
			}

			var html = 
				//  '<div class="col s2">'
				//	+ '<img src="'+((data[i].favicon!==undefined)?data[i].favicon:"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==")+'" style="width:16px;height16px;"/>'
				//+ '</div>'
				'<div class="col s12">'
					+ '<small>'+data[i].tw+'</small><br>'
					+ '<span class="media-heading"><a href="'+data[i]._id+'" class="result-title">'+title+'</a></span><br>'
					+ '<span class="result-url">'
						+ '<img src="'+((data[i].favicon!==undefined)?data[i].favicon:"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==")+'" style="width:16px;height16px;"/> '
						+ url
					+ '</span><br>'
					//+ '<small>'+formatDateDiff(new Date(data[i].date))+'</small> <span>' + a.hostname + "</span> <span>("+data[i].weight+")</span>"
					+ '<div class="result-description">'+description+'</div>'
				+ '</div>';

			/*
			var html = 
			'<a class="media-left " href="'+data[i]._id+'">'
				+ '<img src="'+((data[i].favicon!==undefined)?data[i].favicon:"data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==")+'" style="width:16px;height16px;"/>'
				+ '</a>'
				+ '<div class="media-body">'
				+ '<small>'+data[i].tw+'</small><br>'
				+ '<span class="media-heading"><a href="'+data[i]._id+'" class="result-title">'+title+'</a></span><br>'
				+ '<span class="result-url">'+url+'</span><br>'
				//+ '<small>'+formatDateDiff(new Date(data[i].date))+'</small> <span>' + a.hostname + "</span> <span>("+data[i].weight+")</span>"
				+ '<div class="result-description">'+description+'</div>'
				+ '</div>';
			*/
			elem.html(html).appendTo($div);
		}
	};

	$('#search_button').click(function(){
		$.ajax({
			url : "search/",
			type : "GET",
			data : {
				s: $("#search").val()
			},
			dataType : "json",
			success : function(data){
				render_web_results(data,$("#search").val().split(' '));
			}
		});
	});
});