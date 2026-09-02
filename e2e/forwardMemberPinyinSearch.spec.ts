import { expect, test } from "@playwright/test";

import { filterByFuzzyPinyin } from "../src/utils/pinyin";

test("matches enterprise member names by Chinese text, full pinyin, initials, and partial pinyin", () => {
  const members = [
    { userID: "u-zhang-san", nickname: "张三" },
    { userID: "u-li-si", nickname: "李四" },
  ];

  for (const keyword of ["张三", "zhangsan", "zs", "zhang", "san"]) {
    expect(filterByFuzzyPinyin(members, keyword)).toEqual([members[0]]);
  }
});
