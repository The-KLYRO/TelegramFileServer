# src/Config/_links.py
import os

CHANNEL_LINK = 'https://t.me/pc_games_4_u'
LOGO = 'https://i.ibb.co/LhZtvnVz/6217502998695889825-99.jpg'


def _list_imgs(directory):
    """Return image paths in directory; empty list if the dir doesn't exist."""
    if not os.path.isdir(directory):
        return []
    return [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp"))
    ]


SEARCH_IMGS = _list_imgs("assets/IMGS/SEARCH")
START_IMGS = _list_imgs("assets/IMGS/START")