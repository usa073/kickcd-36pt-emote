export interface Video {
  livestream: {
    channel_id: number;
    session_title: string;
    start_time: string;
    duration: number;
  };
}

export interface Chat {
  vpos: number;
  posted_at: Date;
  user_id: string;
  message: string;
}

export interface Options {
  font_name: string;
  font_size: number;
  margin: number;
  outline: number;
  displayed_time: number;
}
