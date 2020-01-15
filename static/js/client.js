var entryHtml = "<li class='collection-item'><form method='POST'>"
              + "<input type='hidden' class='id-input' name='entry_id'>"
              + "<div class='primary-content'>&nbsp;</div>"
              + "<div class='secondary-content'>"
              + "<span class='right helping-text'></span>"
              + "</div>"
              + "<div class='clear'></div>"
              + "</form></li>";

var removeHtml = "<button class='waves-effect waves btn-flat grey lighten-3 grey-text text-darken-2 remove-button' name='action' value='REM'>Remove</button>";
var cancelHtml = "<button class='waves-effect waves btn-flat grey lighten-3 grey-text text-darken-2' name='action' value='CANCEL'>Cancel</button>";
var doneHtml = "<button class='waves-effect waves-light btn blue' name='action' value='DONE'>Done</button>";
var helpHtml = "<button class='waves-effect waves-light btn blue' name='action' value='HELP'>Help</button>";
var xHtml = "<button class='waves-effect waves btn-flat grey lighten-2 black-text x-button' name='action' value='CANCEL'>X</button>";

var mq;

$(document).ready(function() {
    $('select').material_select();
    $(document).on("click", ".remove-button", function(event) {
        if (!$(this).hasClass("confirming")) {
            $(".confirming").each(function() {
                $(this).removeClass("confirming red white-text")
                    .addClass("grey lighten-3 grey-text text-darken-2")
                    .text("Remove");
            });
            $(this).addClass("confirming red white-text")
                .removeClass("grey lighten-3 grey-text text-darken-2")
                .text("Are you sure?");
            event.preventDefault();
        }
    });
    $(document).click(function(event) {
        if (!$(event.target).hasClass("remove-button")) {
            $(".confirming").each(function() {
                $(this).removeClass("confirming red white-text")
                    .addClass("grey lighten-3 grey-text text-darken-2")
                    .text("Remove");
            });
        }
    });
    mq = window.matchMedia("(min-width: 761px)");
    mq.onchange = positionOverlay;
});


function editMessage() {
    $("#message").hide();
    $("#message_form").show();
    var len = $("#message_form input").val().length;
    $("#message_form input").focus().get(0).setSelectionRange(len, len);
}

function cancelEditMessage() {
    $("#message_form").hide();
    $("#message").show();
}


//REQUIRED FIELDS: id, status, name, user_id, ta_id, topic_name, ta_full_name, question
function buildTAEntry(entry) {
    var elt = $(entryHtml);
    elt.data("entryId", entry.id);
    elt.find(".id-input").val(entry.id);
    elt.find(".primary-content").html(
        "<div>" + entry.name + " (" + entry.user_id + ")</div>"
        + "<div>" + entry.topic_name + "</div>"
        + "<div>" + entry.question + "</div>"
    );

    if (entry.status == 1 && ta_id == entry.ta_id) {
        elt.find(".helping-text").text("You are helping")
            .after($("<br>" + cancelHtml + "&nbsp;" + doneHtml));
    } else if (entry.status == 1) {
        elt.find(".helping-text").html(entry.ta_full_name + " is helping " + xHtml);
    } else if (!ta_helping_id) {
        if (ta_id) {
            elt.find(".helping-text")
                .after($(removeHtml + "&nbsp;" + helpHtml));
        } else {
            elt.find(".helping-text").after($(removeHtml));
        }
    }
    return elt;
}

//REQUIRED FIELDS: id, status, name, user_id, topic_name, ta_full_name
function buildMyEntry(entry) {
    var elt = $(entryHtml);
    elt.addClass("me");
    elt.data("entryId", entry.id);
    elt.find(".id-input").val(entry.id);
    elt.find(".primary-content").html(
        "<div>" + entry.name + " (" + entry.user_id + ")</div>"
      + "<div>" + entry.topic_name + "</div>"
        + "<div>" + entry.question + "</div>"
    );
    if (entry.status == 1) {
        elt.find(".helping-text").text(entry.ta_full_name + " is helping");
    } else {
        elt.find(".helping-text").after($(removeHtml));
    }
    return elt;
}

//REQUIRED FIELDS: id, status, ta_full_name
function buildStudentEntry(entry) {
    var elt = $(entryHtml);
    elt.data("entryId", entry.id);
    elt.find(".id-input").val(entry.id);
    if (entry.status == 1) {
        elt.find(".helping-text").text(entry.ta_full_name + " is helping");
    }
    return elt;
}

function positionOverlay() {
    var me = $("#queue").find(".me");
    var ahead;
    var last;
    if (me.length > 0) {
        ahead = me.prevAll().length;
        last = me.prev();
    } else {
        ahead = $("#queue").children().length;
        last = $("#queue").last();
    }
    if (ahead >= 3 && !ta_id && mq.matches) {
        $("#status").addClass("overlay");
        var totalheight = last.offset().top + last.outerHeight() - $("#queue").offset().top;
        $("#status").css("top", totalheight * 0.15);
        $("#status").css("height", totalheight * 0.7);
    } else {
        $("#status").removeClass("overlay");
        $("#status").removeAttr("style");
    }
}

function updateStatus() {
    var me = $("#queue").find(".me");
    var statushtml = "";
    if (me.length > 0) {
        var ahead = me.prevAll().length;
        if (ahead == 0) {
            statushtml += "You're currently first in the queue.";
        } else if (ahead == 1) {
            statushtml += "There is 1 student ahead of you.";
        } else {
            statushtml += "There are " + ahead + " students ahead of you.";
        }
        if (me.index() < waittimes.length) {
            var time = Math.ceil(waittimes[me.index()]/60);
            if (time < 3) {
                time = "less than 3";
            }
            statushtml += "<br>Your estimated wait time is " + time + " minutes.";
        }
    } else {
        var ahead = $("#queue").children().length;
        if (ahead == 0) {
            statushtml += "There are no students on the queue.";
        } else if (ahead == 1) {
            statushtml += "There is 1 student on the queue.";
        } else {
            statushtml += "There are " + ahead + " students on the queue.";
        }
        if (waittimes.length == ahead+1) {
            var time = Math.ceil(waittimes[ahead]/60);
            if (time < 3) {
                time = "less than 3";
            }
            statushtml += "<br>The estimated wait time is " + time + " minutes.";
        }
    }
    $("#status_content").html(statushtml);
    $("#num_ahead").text(ahead);
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function checkAndUpdateSeq(message_seq) {
    if (message_seq != seq + 1) {
        window.location.reload();
        throw new Error("Queue data is out of date. Reloading...");
    }
    seq = message_seq;
}

var socket = io();
socket.on("connect", function () {
    socket.emit("authenticate", unescape(getCookie("auth")));
    if (ta_id) {
        // notification permission request on connect if is ta
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notification");
        } else if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }
});
$(document).on("submit", "form", function(event) {
    socket.disconnect();
});

socket.on("add", function(message) {
    // notification on add for ta
    try {
        if ( ta_id && ("Notification" in window) && (Notification.permission == "granted") ) {
            var notification = new Notification("New Queue Entry",
                {"body": "Name: " + message.data.name + "\n" +
                        "Andrew ID: " + message.data.user_id + "\n" +
                        "Topic: " + message.data.topic_name
                });
        }
    } catch (error) {
        console.log("There was an error showing a browser notification.");
    }
    checkAndUpdateSeq(message.seq);
    var elt = null;
    if (ta_id || is_owner) {
        elt = buildTAEntry(message.data);
    } else {
        elt = buildStudentEntry(message);
    }
    $("#queue").append(elt);
    positionOverlay();
    updateStatus();
});

socket.on("remove", function(message) {
    checkAndUpdateSeq(message.seq);
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            if ($(item).hasClass("me")) {
                $("#add_form").show();
            }
            $(item).remove();
        }
    });
    positionOverlay();
    updateStatus();
});

socket.on("help", function(message) {
    checkAndUpdateSeq(message.seq);
    if (ta_id == message.data.ta_id) {
        //you just started helping someone, this changes everything so reload
        window.location.reload();
        return;
    }
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).find("button").remove();
            $(item).find("br").remove();
            $(item).find(".helping-text").text(message.data.ta_full_name + " is helping");
            if (ta_id) {
                $(item).find(".helping-text").append(xHtml);
            }
        }
    });
});

socket.on("cancel", function(message) {
    checkAndUpdateSeq(message.seq);
    if (ta_id == message.data.ta_id) {
        //you just cancelled helping someone, this changes everything so reload
        window.location.reload();
        return;
    }
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).find(".helping-text").text("");
            if ($(item).hasClass("me")) {
                $(item).find(".helping-text").after($(removeHtml));
            } else if (ta_id && !ta_helping_id) {
                $(item).find(".helping-text")
                    .after($(removeHtml + "&nbsp;" + helpHtml));
            }
        }
    });
});

socket.on("done", function(message) {
    checkAndUpdateSeq(message.seq);
    if (ta_id == message.data.ta_id) {
        //you just finished helping someone, this changes everything so reload
        window.location.reload();
        return;
    }
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            if ($(item).hasClass("me")) {
                $("#add_form").show();
            }
            $(item).remove();
        }
    });
    positionOverlay();
    updateStatus();
});

socket.on("option", function(message) {
    checkAndUpdateSeq(message.seq);
    if (message.key == "frozen") {
        if (message.value == "1") {
            $("#frozen_message").show();
            if (ta_id) {
                $(".freeze-input").val(0);
                $(".freeze-btn").text("Unfreeze");
            } else {
                $("#add_form").hide();
            }
        } else {
            $("#frozen_message").hide();
            if ($("#queue").find(".me").length == 0) {
                $("#add_form").show();
            }
            if (ta_id) {
                $(".freeze-input").val(1);
                $(".freeze-btn").text("Freeze");
            }
        }
    } else if (message.key == "message") {
        if (ta_id) {
            window.location.reload();
            return;
        }
        $("#message_content").html(message.value);
    }
});

socket.on("waittimes", function(message) {
    checkAndUpdateSeq(message.seq);
    console.log("Got wait times: " + message.times);
    waittimes = message.times;
    updateStatus();
});
