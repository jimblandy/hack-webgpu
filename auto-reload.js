var events = new EventSource("events");
events.addEventListener("files-changed", (event) => {
    events.close();
    location.reload()
})

events.onerror = (err) => {
    console.error("server-sent event source 'event' failed");
};
