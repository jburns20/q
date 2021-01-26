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

function HelpingText(props) {
    return <div className='helping-text teal-text lighten-1'>
        {props.status == 1 && (!!props.ta_id && props.ta_id == ta_id
            ? "You are helping"
            : props.ta_full_name + " is helping"
        )}
        {props.status == 1 && !!ta_id && props.ta_id != ta_id &&
            <button className='waves-effect waves btn-flat grey lighten-2 black-text x-button' name='action' value='CANCEL'>X</button>
        }
    </div>;
}

function RemoveButton() {
    const [confirming, setConfirming] = React.useState(false);
    const ref = React.createRef();
    React.useEffect(()=>{
        function documentClick(event) {
            if (confirming && ref.current && !ref.current.contains(event.target)) {
                setConfirming(false);
            }
        }
        document.addEventListener("click", documentClick);
        return () => { document.removeEventListener("click", documentClick); };
    });
    function onClick(e) {
        if (!confirming) {
            setConfirming(true);
            e.preventDefault();
        }
    }
    const classNames = confirming ? 'confirming red white-text' : 'grey lighten-3 grey-text text-darken-2';
    return <button className={'entry-item remove-button waves-effect waves btn-flat ' + classNames}
                   name='action'
                   value='REM'
                   onClick={onClick}
                   ref={ref}>
        {confirming ? 'Are you sure?' : 'Remove'}
    </button>;
}

function HelpButton() {
    return <button className='entry-item help-button waves-effect waves-light btn blue' name='action' value='HELP'>Help</button>;
}

function CancelButton() {
    return <button className='entry-item cancel-button waves-effect waves btn-flat grey lighten-3 grey-text text-darken-2' name='action' value='CANCEL'>Cancel</button>;
}

function DoneButton() {
    return <button className='entry-item done-button waves-effect waves-light btn blue' name='action' value='DONE'>Done</button>;
}

function Entry(props) {
    var classNames = "collection-item";
    if (props.kind == "myEntry") {
        classNames += " me";
    }
    return <li className={classNames} data-id={props.id}>
        <form method='POST'>
            <HelpingText {...props}/>
            <div className='entry-container'>
                <input type='hidden' className='id-input' name='entry_id' value={props.id}/>
                <div className='entry-item entry-container entry-text'>
                    <div className='entry-item entry-name'>
                        {props.name}
                        {' '}
                        {!!props.user_id && "(" + props.user_id + ")"}
                    </div>
                    <div className='entry-item entry-question'>
                        {props.cooldown_override && '\u21BB'}
                        {' '}
                        {!!props.topic_name && "[" + props.topic_name + "]"}
                        {' '}
                        {!!props.question && props.question.replace(/</g, "&lt;")}
                    </div>
                </div>
                <div className='entry-item entry-spacer'></div>
                <div className='entry-item entry-container entry-buttons'>
                    {props.status != 1 && (props.kind == "myEntry" || ta_id || is_owner) && !ta_helping_id && <RemoveButton/>}
                    {props.status != 1 && !ta_helping_id && !!ta_id && <HelpButton/>}
                    {props.status == 1 && !!props.ta_id && props.ta_id == ta_id && <CancelButton/>}
                    {props.status == 1 && !!props.ta_id && props.ta_id == ta_id && <DoneButton/>}
                </div>
            </div>
        </form>
    </li>;
}

function EntryList(props) {
    return <ul className="collection" id="queue">
        {props.entries.map((entry) =>
            <Entry key={entry.id} {...entry}/>
        )}
    </ul>;
}

function QueueContainer(props) {
    return <>
        <div id="status">
            <div className="inner">
            <div id="status_content"></div>
            </div>
        </div>
        <EntryList entries={props.entries}/>
    </>;
}

function renderQueueContainer() {
    ReactDOM.render(<QueueContainer entries={entries}/>, document.getElementById("queue_container"));
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
    if (ta_id || is_owner) {
        entries.push(message.data);
    } else {
        entries.push({ id: message.id });
    }
    renderQueueContainer();
    positionOverlay();
    updateStatus();
});

socket.on("remove", function(message) {
    if (disable_updates) return;
    checkAndUpdateSeq(message.seq);
    const index = entries.findIndex((entry) => { return entry.id == message.id; });
    if (index >= 0) {
        if (entries[index].kind == 'myEntry') {
            $("#add_form").show();
        }
        entries.splice(index, 1);
    }
    renderQueueContainer();
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
        if ($(item).attr("data-id") == message.id) {
            $(item).find("button").addClass("hide");
            $(item).find(".helping-text").text(message.data.ta_full_name + " is helping");
            if (ta_id) {
                $(item).find(".helping-text").append(xHtml);
            }
            if ($(item).hasClass("me")) {
                try {
                    if (("Notification" in window) && (Notification.permission == "granted")) {
                        var notification = new Notification("It's your turn to get help!", {
                            "body": message.data.ta_full_name + " is ready to help you."
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
        if ($(item).attr("data-id") == message.id) {
            $(item).find(".helping-text").text("");
            if ($(item).hasClass("me")) {
                $(item).find(".remove-button").removeClass("hide");
                M.Modal.getInstance($("#help_modal")).close();
            } else if (ta_id && !ta_helping_id) {
                $(item).find(".remove-button").removeClass("hide");
                $(item).find(".help-button").removeClass("hide");
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
    const index = entries.findIndex((entry) => { return entry.id == message.id; });
    if (index >= 0) {
        if (entries[index].kind == 'myEntry') {
            $("#add_form").show();
        }
        entries.splice(index, 1);
    }
    renderQueueContainer();
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
