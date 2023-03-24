/// This is meant to be used with the [serve-live] static directory
/// server, which notifies the page when files in the directory have
/// changed, using server-sent events.
///
/// [serve-live]: https://github.com/jimblandy/serve-live/
var events = new EventSource("events");
events.addEventListener("files-changed", (event) => {
    events.close();
    location.reload()
})

events.onerror = (err) => {
    console.log("server-sent event source 'event' failed");
};

// Avoid Firefox error when page is reloaded.
// https://bugzilla.mozilla.org/show_bug.cgi?id=833462#c11
window.addEventListener('beforeunload', () => {
    events.close();
});
