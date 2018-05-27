exports.is_owner = function(req) {
    if (req.session && req.session.owner) {
        return true;
    }
    return false;
}

exports.is_admin = function(req) {
    if (req.session && req.session.TA && req.session.TA.admin) {
        return true;
    }
    if (req.session && req.session.owner) {
        return true;
    }
    return false;
}

exports.is_ta = function(req) {
    if (req.session && req.session.TA) {
        return true;
    }
    return false;
}

exports.is_logged_in = function(req) {
    if (req.session && req.session.authenticated) {
        return true;
    }
    return false;
}
