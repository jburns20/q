const fixQuestionIconHtml = "<i class='qedit-icon material-icons' style='font-size: 20px; margin: 0px -15px;'>help_outline</i>"
const removeHtml = "<button class='entry-item remove-button hide waves-effect waves btn-flat grey lighten-3 grey-text text-darken-2' name='action' value='REM'>Remove</button>";
const cancelHtml = "<button class='entry-item cancel-button hide waves-effect waves btn-flat grey lighten-3 grey-text text-darken-2' name='action' value='CANCEL'>Cancel</button>";
const requestUpdateHtml = `<button class='entry-item fix-question-button hide waves-effect waves btn-flat grey lighten-2 grey-text text-darken-3' name='action' value='REQUEST-UPDATE'>${fixQuestionIconHtml}</button>`;
const doneHtml = "<button class='entry-item done-button hide waves-effect waves-light btn blue' name='action' value='DONE'>Done</button>";
const helpHtml = "<button class='entry-item help-button hide waves-effect waves-light btn blue' name='action' value='HELP'>Help</button>";
const openUpdateQuestionModalHtml = "<button class='entry-item open-update-question-button hide waves-effect waves btn-flat grey lighten-2 grey-text text-darken-3'>Update Question</button>";

const entryHtml = `
    <li class='collection-item'>
        <form method='POST'>
            <div class='helping-text teal-text lighten-1'></div>
            <div class='entry-container'>
                <input type='hidden' class='id-input' name='entry_id'>
                <div class='entry-item entry-container entry-text'>
                    <div class='entry-item entry-name'></div>
                    <div class='entry-item entry-question'></div>
                </div>
                <div class='entry-item entry-spacer'></div>
                <div class='entry-item entry-container entry-buttons'>
                    ${requestUpdateHtml}
                    ${openUpdateQuestionModalHtml}
                    ${removeHtml}
                    ${helpHtml}
                    ${cancelHtml}
                    ${doneHtml}
                </div>
            </div>
        </form>
    </li>
`;

var xHtml = "<button class='waves-effect waves btn-flat grey lighten-2 black-text x-button' name='action' value='CANCEL'>X</button>";

var mq;
var disable_updates = false;

function submitAddForm(cooldown_override) {
    var data = $("#add_form form").serialize() + "&action=ADD";
    if (cooldown_override) {
        data = data + "&cooldown_override=1";
    }
    $.post("/?json=1", data, function(result) {
        if (result.data && result.data.cooldown_warning) {
            disable_updates = false;
            $("#modal_cooldown_time").text(result.data.cooldown_time);
            M.Modal.getInstance($("#cooldown_modal")).open();
        } else {
            document.cookie = "toast=" + result.message;
            window.location.reload();
        }
    }, 'json');
}

$(document).ready(function() {
    $('select').formSelect();
    $('.modal').modal();

    // MaterializeCSS hides the native select, which causes the data-error to not show up
    // This is a little bit of a "hacky" way to ensure the user selects a topic
    $('select[required]').css({display: "block", top: "0%", padding: 0, opacity: 0, position: 'absolute'});

    // Enables confirmation for the Remove button
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

    // Manages confirmation for fix question button
    $(document).on("click", ".fix-question-button", function(event) {
        if (!$(this).hasClass("fix-confirming")) {
            $(".fix-confirming").each(function() {
                $(this).removeClass("fix-confirming red white-text")
                    .addClass("grey lighten-2 grey-text text-darken-3")
                    .html(fixQuestionIconHtml);
            });
            $(this).addClass("fix-confirming red white-text")
                .removeClass("grey lighten-2 grey-text text-darken-3")
                .text("Ask to Fix");
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
        if (!$(event.target).hasClass("fix-question-button") && !$(event.target).hasClass("qedit-icon")) {
            $(".fix-confirming").each(function() {
                $(this).removeClass("fix-confirming red white-text")
                    .addClass("grey lighten-2 grey-text text-darken-3")
                    .html(fixQuestionIconHtml);
            });
        }
    });

    $(document).on("click", ".open-update-question-button", function(event) {
        const elt = $("#update_question_modal");
        elt.find(".id-input").val($("#queue").find(".me").data("entryId"));
        M.Modal.getInstance(elt).open();
        event.preventDefault();
    });

    mq = window.matchMedia("(min-width: 761px)");
    mq.onchange = positionOverlay;

    $("#add_form form").submit(function(event) {
        event.preventDefault();
        submitAddForm(false);
    });

    $("#cooldown_override_submit").click(function(event) {
        event.preventDefault();
        disable_updates = true;
        submitAddForm(true);
    })

    $('textarea#question').characterCounter();
});


function editMessage() {
    $("#message").hide();
    $("#message_form").show();
    var len = $("#message_form textarea").val().length;
    $("#message_form textarea").focus().get(0).setSelectionRange(len, len);
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
    elt.find(".entry-name").html(`${entry.name} (${entry.user_id})`);
    elt.find(".entry-question").html(`${entry.cooldown_override ? '\u21BB ' : ''}[${entry.topic_name}] ${entry.question.replace(/</g, "&lt;")}`);

    if (entry.status == 1 && ta_id == entry.ta_id) {
        elt.find(".cancel-button").removeClass("hide");
        elt.find(".done-button").removeClass("hide");
        elt.find(".helping-text").text("You are helping");
    } else if (entry.status == 1) {
        elt.find(".helping-text").html(`${entry.ta_full_name} is helping ${xHtml}`);
    } else if (!ta_helping_id) {
        elt.find(".remove-button").removeClass("hide");
        if (ta_id) {
            elt.find(".help-button").removeClass("hide");
            if (entry.update_requested) {
                elt.find(".help-button")
                    .removeClass("waves-light btn blue")
                    .addClass("waves btn-flat grey lighten-3 grey-text text-darken-2");
                elt.find(".helping-text").text("Student is updating question");
            } else {
                elt.find(".fix-question-button").removeClass("hide");
            }
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
    elt.find(".entry-name").html(`${entry.name} (${entry.user_id})`);
    elt.find(".entry-question").html(`[${entry.topic_name}] ${entry.question.replace(/</g, "&lt;")}`);

    if (entry.status == 1) {
        elt.find(".helping-text").text(entry.ta_full_name + " is helping");
    } else {
        if (entry.update_requested) {
            elt.find(".open-update-question-button").removeClass("hide");
            elt.find(".helping-text").text("Please update your question");
        }
        elt.find(".remove-button").removeClass("hide");
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
    // notification permission request on connect
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
    } else if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
});

$(document).on("submit", "form", function(event) {
    disable_updates = true;
});

socket.on("add", function(message) {
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);
    // notification on add for ta
    try {
        if ( ta_id && ("Notification" in window) && (Notification.permission == "granted") ) {
            var notification = new Notification("New Queue Entry", {
                "body": "Name: " + message.data.name + "\n" +
                        "Andrew ID: " + message.data.user_id + "\n" +
                        "Topic: " + message.data.topic_name
            });
        }
    } catch (error) {
        console.log("There was an error showing a browser notification.");
    }
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

socket.on("request-update", function(message) {
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);

    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).find("button").addClass("hide");

            if ($(item).hasClass("me")) {
                $(item).find(".remove-button").removeClass("hide");
                $(item).find(".helping-text").text("Please update your question");
                $(item).find(".open-update-question-button").removeClass("hide");

                try {
                    if (("Notification" in window) && (Notification.permission == "granted")) {
                        var notification = new Notification("Update Question Request", {
                            "body": "Please refine your question so we can help you more efficiently.",
                            "requireInteraction": true
                        });
                    }
                } catch (error) {
                    console.log("There was an error showing a browser notification.");
                }

                const elt = $("#update_question_modal");
                elt.find(".id-input").val(message.id);
                M.Modal.getInstance(elt).open();
            } else if (ta_id) {
                if (!ta_helping_id) {
                    $(item).find(".remove-button").removeClass("hide");
                    $(item).find(".help-button").removeClass("hide")
                        .removeClass("waves-light btn blue")
                        .addClass("waves btn-flat grey lighten-3 grey-text text-darken-2");
                }
                $(item).find(".helping-text").text("Student is updating question");
            }
        }
    });
});

socket.on("update-question", function(message) {
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);

    if (!ta_id) {
        return; // Nothing more to be done for students
    }

    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).find("button").addClass("hide");
            $(item).find(".helping-text").text("");

            if (!ta_helping_id) {
                $(item).find(".remove-button").removeClass("hide");
                $(item).find(".help-button").removeClass("hide")
                    .addClass("waves-light btn blue")
                    .removeClass("waves btn-flat grey lighten-3 grey-text text-darken-2");
                $(item).find(".fix-question-button").removeClass("hide");
            }

            // To prevent needing to pass all the fields required for entry-question (topic, cooldown)
            // We substring the old question to retrieve the "header", then append the updated question
            const entry_question = $(item).find(".entry-question")
            const old_question = entry_question.html().toString();
            const question_header = old_question.substring(0, old_question.indexOf("]") + 2);
            entry_question.html(`${question_header} ${message.updated_question.replace(/</g, "&lt;")}`);
        }
    });
});

socket.on("remove", function(message) {
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            if ($(item).hasClass("me")) {
                $("#add_form").show();
                M.Modal.getInstance($("#update_question_modal")).close();
            }
            $(item).remove();
        }
    });
    positionOverlay();
    updateStatus();
});

socket.on("help", function(message) {
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);
    if (ta_id == message.data.ta_id) {
        //you just started helping someone, this changes everything so reload
        window.location.reload();
        return;
    }
    $("#queue li").each(function(index, item) {
        if ($(item).data("entryId") == message.id) {
            $(item).find("button").addClass("hide");
            $(item).find(".helping-text").text(message.data.ta_full_name + " is helping");
            if (ta_id) {
                $(item).find(".helping-text").append(xHtml);
            }
            if ($(item).hasClass("me")) {
                try {
                    if (("Notification" in window) && (Notification.permission == "granted")) {
                        var notification = new Notification("It's your turn to get help!", {
                            "body": message.data.ta_full_name + " is ready to help you.",
                            "requireInteraction": true
                        });
                    }
                } catch (error) {
                    console.log("There was an error showing a browser notification.");
                }
                $("#modal_ta_name").text(message.data.ta_full_name);
                if (message.data.ta_video_chat_url && message.data.ta_video_chat_url.length > 0) {
                    $("#modal_ta_video_chat_url").show();
                    $("#modal_ta_video_chat_url").attr("href", message.data.ta_video_chat_url);
                } else {
                    $("#modal_ta_video_chat_url").hide();
                }

                M.Modal.getInstance($("#update_question_modal")).close();
                M.Modal.getInstance($("#help_modal")).open();
            }
        }
    });
});

socket.on("cancel", function(message) {
    if (disable_updates) return;
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
                $(item).find(".remove-button").removeClass("hide");
                M.Modal.getInstance($("#help_modal")).close();
            } else if (ta_id && !ta_helping_id) {
                $(item).find(".remove-button").removeClass("hide");
                // revert color if student was helped while updating question
                $(item).find(".help-button").removeClass("hide")
                    .removeClass("waves btn-flat grey lighten-3 grey-text text-darken-2")
                    .addClass("waves-light btn blue");
                $(item).find(".fix-question-button").removeClass("hide");
            }
        }
    });
});

socket.on("done", function(message) {
    if (disable_updates) return;
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
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);
    if (message.key == "frozen") {
        if (message.value == "1") {
            $("#frozen_message").show();
            if (ta_id) {
                $(".freeze-input").val(0);
                $(".freeze-btn").text("Unfreeze");
            } else {
                $("#add_form").hide();
                $("#cooldown_override_text").hide();
            }
        } else {
            $("#cooldown_override_text").show();
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
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);
    console.log("Got wait times: " + message.times);
    waittimes = message.times;
    updateStatus();
});

socket.on("notifytime", function(message) {
    if (disable_updates) return;

    message.notif_tas.forEach(ta => {
        if (ta_id == ta.id) {
            try {
                if (("Notification" in window) && (Notification.permission == "granted")) {
                    var notification = new Notification("Time Alert!", {
                        "body": "You've been helping for " + ta.min_elapsed + " minutes!",
                        "requireInteraction": true
                    });
                }
            } catch (error) {
                console.log("There was an error showing a browser notification.");
            }
            return; // Can only have at most one notification
        }
    });
});

