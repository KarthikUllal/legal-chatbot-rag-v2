import feedparser

RSS_FEEDS=[
"https://www.livelaw.in/rss/latest",
"https://www.scconline.com/blog/feed/"
]

def get_news():

    articles=[]

    for feed in RSS_FEEDS:

        parsed=feedparser.parse(feed)

        for entry in parsed.entries[:5]:

            articles.append({
                "title":entry.title,
                "link":entry.link
            })

    return articles