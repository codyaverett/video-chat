export class User {
    constructor(id, name, audioEnabled = true, videoEnabled = true) {
        this.id = id;
        this.name = name;
        this.audioEnabled = audioEnabled;
        this.videoEnabled = videoEnabled;
        this.videoFilter = 'none';
    }
}