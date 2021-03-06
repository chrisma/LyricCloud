$( document ).ready(function() {
	var maxLength = 30;
	//from https://github.com/jdf/cue.language
	var stopWords = /^(i|me|my|myself|we|us|our|ours|ourselves|you|your|yours|yourself|yourselves|he|him|his|himself|she|her|hers|herself|it|its|itself|they|them|their|theirs|themselves|what|which|who|whom|whose|this|that|these|those|am|is|are|was|were|be|been|being|have|has|had|having|do|does|did|doing|will|would|should|can|could|ought|i'm|you're|he's|she's|it's|we're|they're|i've|you've|we've|they've|i'd|you'd|he'd|she'd|we'd|they'd|i'll|you'll|he'll|she'll|we'll|they'll|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|don't|didn't|won't|wouldn't|shan't|shouldn't|can't|cannot|couldn't|mustn't|let's|that's|who's|what's|here's|there's|when's|where's|why's|how's|a|an|the|and|but|if|or|because|as|until|while|of|at|by|for|with|about|against|between|into|through|during|before|after|above|below|to|from|up|upon|down|in|out|on|off|over|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|say|says|said|shall)$/;
	var fill = d3.scale.category20(); //colors
	var fontSize = d3.scale.log().range([15, 105]);
	var width = 900;
	var height = 500;

	var URLhash = location.hash.replace('#', '');
	var ArtistAndSong = URLhash || randomPropertyName(cache);

	var lyricsURL = "http://lyrics.wikia.com/" + ArtistAndSong + "?useskin=wikiamobile"
	lyricsURL = lyricsURL.replace("'",'');
	var queryURL = "https://query.yahooapis.com/v1/public/yql?" +
		"q=select * from html where url='" + lyricsURL + "' and " +
		"xpath='//div[@class=%22lyricbox%22]'&" +
		"format=json&callback=?"

	var split = ArtistAndSong.split(':');
	$('#artist').val(split[0].replace(/_/g,' ').title());
	$('#song').val(split[1].replace(/_/g,' ').title());

	fetchAndDisplayLyrics(ArtistAndSong);

	$(window).on('hashchange',function(){
		window.location.reload();
	});

	$("#artist, #song").keyup(function (e) {
		if (e.keyCode == 13) { //Enter
			var artistSong = $('#artist').val() + ':' + $('#song').val();
			artistSong = artistSong.trim().replace(/ /g, '_').toLowerCase();
			window.location.hash = artistSong;
		}
	});

	$("#download-svg").on("click", downloadSVG);
	$("#download-png").on("click", downloadPNG);

	var focusedElement;
	$(document).on('focus', 'input', function () {
		if (focusedElement == $(this)) return;
		focusedElement = $(this);
		//Needed for Chrome
		setTimeout(function () { focusedElement.select(); }, 10);
	});
	$(document).on('blur', 'input', function(){focusedElement = null;})

	function downloadSVG() {
		$("#lyricscloud").attr({ version: '1.1' , xmlns:"http://www.w3.org/2000/svg"});
		var svg = $("#svg-container").html().trim();
		var b64 = btoa(unescape(encodeURIComponent(svg)));
		$(this).attr("href", "data:image/svg+xml;charset=utf-8;base64," + b64);
	}

	function downloadPNG() {
		canvg($('#hidden-canvas')[0], $("#svg-container").html().trim());
		$(this).attr("href", $('#hidden-canvas')[0].toDataURL("image/png"));
	}

	function randomPropertyName(obj) {
		var keys = Object.keys(obj)
		return keys[ keys.length * Math.random() << 0];
	}

	function fetchAndDisplayLyrics(artistSong) {
		$('#error').hide();
		//Check if the lyrics are in static cache
		if (artistSong in cache) {
			console.log("Lyrics found in cache: ", artistSong);
			setupTagCloud(cache[artistSong]);
			return
		} 
		//Fetch lyrics from LyricsWiki
		$.getJSON( queryURL, function( data ) {
			try {
				var root = data.query.results.div.p;
			} catch(e) { //TypeError
				console.log('ERROR retrieving lyrics:', lyricsURL);
				console.log(queryURL);
				$('#loader').hide();
				$('#error').show();
				return
			}
			setupTagCloud(processLyricJSON(root));
		}).fail( function(jqxhr, textStatus, error){
			$('#loader').hide();
			$('#error').show();
			console.log("ERROR ", jqxhr, textStatus, error);
		});
	}


	function processLyricJSON(json) {
		var wordCounts = {};
		var result = [];
		var lyrics = json.content;
		if (json.em) lyrics += json.em.join(' ');
		lyrics = lyrics.replace(/\r?\n|\r/g, ' '); // get rid of linebreaks
		lyrics = lyrics.replace(/[\[\]|&;$%@<>()+,.!?-]/g, ' '); // get rid of unwanted characters
		lyrics = lyrics.replace(/ +/g, ' '); // get rid of multiple spaces
		lyrics.split(' ').forEach(function(word) {
			word = word.substr(0, maxLength).toLowerCase();
			if (stopWords.test(word.toLowerCase())) return;
			if (word) wordCounts[word] = (wordCounts[word] || 0) + 1;
		});
		$.each(wordCounts, function(key, value){
			result.push({text:key, size:value});
		});
		console.log(JSON.stringify(result));
		return result
	}

	function setupTagCloud(wordObjects){
		$('#loader').hide();
		d3.layout.cloud()
			.size([width, height])
			.words(wordObjects)
			.padding(5)
			.rotate(function() { return 0 })
			.fontSize(function(d) { return fontSize(d.size); })
			.on("end", draw)
			.start();
	}

	function draw(words, selector) {
		d3.select("#lyricscloud")
				.attr("width", width)
				.attr("height", height)
			.append("g")
				.attr("transform", "translate(" + width/2 + "," + height/2 + ")")
			.selectAll("text")
				.data(words)
			.enter().append("text")
				.style("font-size", function(d) { return d.size + "px"; })
				.style("font-family", "serif")
				.style("fill", function(d, i) { return fill(i); })
				.attr("text-anchor", "middle")
				.attr("transform", function(d) {
					return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
				})
				.text(function(d) { return d.text; });
	}

});