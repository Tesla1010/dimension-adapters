import * as sdk from "@defillama/sdk";
import { getPrices } from "../../utils/prices";
import { ethers } from "ethers";
import { CHAIN } from "../../helpers/chains";

const event_notify_reward = 'event NotifyReward(address indexed from,address indexed reward,uint256 indexed epoch,uint256 amount)';
const event_geuge_created = 'event GaugeCreated(address indexed poolFactory,address indexed votingRewardsFactory,address indexed gaugeFactory,address pool,address bribeVotingReward,address feeVotingReward,address gauge,address creator)'

const topic0_geuge_created = '0xef9f7d1ffff3b249c6b9bf2528499e935f7d96bb6d6ec4e7da504d1d3c6279e1';
const contract_interface = new ethers.utils.Interface([
  event_notify_reward,
  event_geuge_created
]);

type TPrice = {
  [s: string]: {
    price: number;
    decimals: number
  };
}
interface ILog {
  data: string;
  transactionHash: string;
  topics: string[];
}

interface IBribes {
  token: string;
  amount: number;
}


export const fees_bribes = async (fromBlock: number, toBlock: number, timestamp: number): Promise<number> => {
  try {
    const voter = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';
    const logs_geuge_created: ILog[] = (await sdk.api.util.getLogs({
      target: voter,
      fromBlock: 3200601,
      toBlock: toBlock,
      topic: '',
      topics: [topic0_geuge_created],
      chain: CHAIN.BASE,
      keys: []
    })).output as ILog[];
    const bribes_contract: string[] = logs_geuge_created.map((e: ILog) => {
      const value = contract_interface.parseLog(e);
      return value.args.bribeVotingReward;
    })

    const logs: ILog[] = (await Promise.all(bribes_contract.map((address: string) => sdk.api.util.getLogs({
      target: address,
      topic: '',
      toBlock: toBlock,
      fromBlock: fromBlock,
      keys: [],
      chain: CHAIN.BASE,
      topics: ['0x52977ea98a2220a03ee9ba5cb003ada08d394ea10155483c95dc2dc77a7eb24b']
    }))))
      .map((p: any) => p)
      .map((a: any) => a.output).flat();

    const logs_bribes = logs.map((e: ILog) => {
      const value = contract_interface.parseLog(e)
      return {
        token: value.args.reward,
        amount: Number(value.args.amount._hex)
      } as IBribes
    })
    const coins = [...new Set(logs_bribes.map((e: IBribes) => `${CHAIN.BASE}:${e.token.toLowerCase()}`))]
    const coins_split: string[][] = [];
    for(let i = 0; i < coins.length; i+=100) {
      coins_split.push(coins.slice(i, i + 100))
    }
    const prices_result: any =  (await Promise.all(coins_split.map((a: string[]) =>  getPrices(a, timestamp)))).flat().flat().flat();
    const prices: TPrice = Object.assign({}, {});
    prices_result.map((a: any) => Object.assign(prices, a))
    const fees_bribes_usd = logs_bribes.map((e: IBribes) => {
      const price = prices[`${CHAIN.BASE}:${e.token.toLowerCase()}`]?.price || 0;
      const decimals = prices[`${CHAIN.BASE}:${e.token.toLowerCase()}`]?.decimals || 0;
      return (Number(e.amount) / 10 ** decimals) * price;
    }).reduce((a: number, b: number) => a+b, 0);
    return fees_bribes_usd;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
