import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

const ANSWER_KEY = 'daily_answer';
const JOB_NAME = 'daily_post';

// Runs every day at 23:59
Devvit.addSchedulerJob({
  name: JOB_NAME,
  onRun: async (_, context) => {
    const { reddit, redis, subredditId } = context;

    const subreddit = await reddit.getSubredditById(subredditId);
    const answer = (await redis.get(ANSWER_KEY)) ?? 'No.';

    await reddit.submitSelfPost({
      subredditName: subreddit.name,
      title: 'Did he die today?',
      text: answer,
    });

    // Auto-reset to "No." after posting "Yes." so it doesn't stick
    if (answer === 'Yes.') {
      await redis.set(ANSWER_KEY, 'No.');
    }
  },
});

// Schedule the job when the app is installed or upgraded
Devvit.addTrigger({
  events: ['AppInstall', 'AppUpgrade'],
  onEvent: async (_, context) => {
    const { scheduler } = context;

    // Clear any existing jobs to avoid duplicates on upgrade
    const existingJobs = await scheduler.listJobs();
    for (const job of existingJobs) {
      await scheduler.cancelJob(job.id);
    }
    
    // 59th minute of the 23rd hour of every day month weekday
    await scheduler.runJob({
      name: JOB_NAME,
      cron: '59 23 * * *',
    });
  },
});

// Mod-only action: set tomorrow's answer to "Yes."
Devvit.addMenuItem({
  label: '[Did He Die] Set answer to YES',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await context.redis.set(ANSWER_KEY, 'Yes.');
    context.ui.showToast("Tonight's post will say: Yes.");
  },
});

// Mod-only action: revert tomorrow's answer back to "No."
Devvit.addMenuItem({
  label: '[Did He Die] Set answer to NO',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    await context.redis.set(ANSWER_KEY, 'No.');
    context.ui.showToast("Tonight's post will say: No.");
  },
});

export default Devvit;
