// server/token-system.js
const userTokens = new Map();

export class TokenSystem {
  static initializeUser(userId) {
    if (!userId) throw new Error('userId required');
    if (!userTokens.has(userId)) {
      userTokens.set(userId, {
        balance: 0,
        staked: 0,
        stakingStart: null
      });
    }
  }

  static awardTokens(userId, rewards) {
    this.initializeUser(userId);
    const total = (rewards?.anc ?? 0) + (rewards?.immunization ?? 0) + (rewards?.growth ?? 0);
    const user = userTokens.get(userId);
    user.balance += total;
    return total;
  }

  static stakeTokens(userId, amount) {
    this.initializeUser(userId);
    const user = userTokens.get(userId);

    if (user.balance < amount) {
      throw new Error('Insufficient balance');
    }

    user.balance -= amount;
    user.staked += amount;
    user.stakingStart = user.stakingStart ?? new Date();
    return {
      staked: user.staked,
      unlockDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000) // 6 months
    };
  }

  static calculateStakingRewards(userId) {
    const user = userTokens.get(userId);
    if (!user || !user.stakingStart) return 0;
    const monthsStaked = (new Date() - new Date(user.stakingStart)) / (30 * 24 * 60 * 60 * 1000);
    const months = Math.min(Math.max(0, monthsStaked), 6);
    return user.staked * 0.005 * months; // 0.5% monthly
  }

  static claimStakedTokens(userId) {
    this.initializeUser(userId);
    const user = userTokens.get(userId);

    if (!user.stakingStart) {
      throw new Error('No staking currently for this user');
    }

    const stakingPeriod = (new Date() - new Date(user.stakingStart)) / (30 * 24 * 60 * 60 * 1000);
    if (stakingPeriod < 6) {
      throw new Error('Staking period not completed. 6 months required.');
    }

    const rewards = this.calculateStakingRewards(userId);
    const total = user.staked + rewards;

    user.balance += total;
    user.staked = 0;
    user.stakingStart = null;
    return total;
  }

  static getUserWallet(userId) {
    this.initializeUser(userId);
    const user = userTokens.get(userId);
    // Return a copy to avoid accidental mutation
    return { balance: user.balance, staked: user.staked, stakingStart: user.stakingStart };
  }
}