var entryHtml = "<li class='collection-item'><form method='POST'>"
              + "<input type='hidden' class='id-input' name='entry_id'>"
              + "<span class='primary-content'>&nbsp;</span>"
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

//REQUIRED FIELDS: id, status, name, user_id, ta_id, ta_full_name
function buildTAEntry(entry) {
    var elt = $(entryHtml);
    elt.data("entryId", entry.id);
    elt.find(".id-input").val(entry.id);
    elt.find(".primary-content").text(entry.name + " (" + entry.user_id + ")");
    if (entry.status == 1 && ta_id == entry.ta_id) {
        elt.find(".helping-text").text("You are helping")
            .after($("<br>" + cancelHtml + "&nbsp;" + doneHtml));
    } else if (entry.status == 1) {
        elt.find(".helping-text").text(entry.ta_full_name + " is helping")
            .after($(xHtml));
    } else if (!ta_helping_id) {
        elt.find(".helping-text")
            .after($(removeHtml + "&nbsp;" + helpHtml));
    }
    return elt;
}

//REQUIRED FIELDS: id, status, name, user_id, ta_full_name
function buildMyEntry(entry) {
    var elt = $(entryHtml);
    elt.addClass("me");
    elt.data("entryId", entry.id);
    elt.find(".id-input").val(entry.id);
    elt.find(".primary-content").text(entry.name + " (" + entry.user_id + ")");
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

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length,c.length);
        }
    }
    return "";
}

var socket = io();
socket.on("connect", function () {
    socket.emit("authenticate", unescape(getCookie("auth")));
});
$(document).on("submit", "form", function(event) {
    socket.disconnect();
});

socket.on("add", function(message) {
    if (message.seq != seq + 1) {
        window.location.reload();
        return;
    }
    var elt = null;
    if (ta_id) {
        elt = buildTAEntry(message.data);
    } else {
        elt = buildStudentEntry(message);
    }
    $("#queue").append(elt);
    seq = message.seq;
});

socket.on("remove", function(message) {
    if (message.seq != seq + 1) {
        window.location.reload();
        return;
    }
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).remove();
        }
    });
    seq = message.seq;
});

socket.on("help", function(message) {
    if (message.seq != seq + 1) {
        window.location.reload();
        return;
    }
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
                $(item).find(".helping-text").after($(xHtml));
            }
        }
    });
    seq = message.seq;
});

socket.on("cancel", function(message) {
    console.log("cancelling: ");
    console.log(message);
    if (message.seq != seq + 1) {
        window.location.reload();
        return;
    }
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
            }
        }
    });
    seq = message.seq;
});

socket.on("done", function(message) {
    if (message.seq != seq + 1) {
        window.location.reload();
        return;
    }
    if (ta_id == message.data.ta_id) {
        //you just finished helping someone, this changes everything so reload
        window.location.reload();
        return;
    }
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).remove();
        }
    });
    seq = message.seq;
});
