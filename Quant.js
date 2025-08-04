var basket1;               // 주식 종목들을 관리하는 Basket 객체
var account1;
var stock_num = 13           // 주식 종목 수
var stock_weight = 0.95        // 자산배분시 주식 비중// 최대 주식 보유 한도. 주식 비중 (거래비용 고려 현금 5% 확보)
var valueRatio = 0.2;
var isFirst = true;             // 시뮬레이션 시작일에 바로 포트폴리오 신규 구성을 하기 위해 사용될 상태 변수
var valueWeightRatio1 = 1;      // 가치가중 100%
var valueWeightRatio2 = 0.5;    // 가치가중 50%
var powerNumber = 1.2;            // 숫자를 높게주면 가치가중 효과를 증폭시킴. 기본값 1.
var rsiPeriod = 10;             //기술적 지표 RSI의 기간 설정. 대체로 사용되는 값은 9일, 14~15일, 25~28일 등이다.(위키백과)
var MonthCount = 12;             //모멘텀 개월수. 12로 주면 12개의 모멘텀을 측정하여 점수를 주식비중을 결정한다.

/////////////////////////////////////////////////////////////////////
//                          초기화 함수                            //
//////////////////////////////////////////////////////////////////// 
function initialize() {
        
    account1 = IQAccount.getDefaultAccount();
    account1.accountName = 'SJJ';    
    basket1 = new Basket(account1, stock_num, IQEnvironment.aum * stock_weight); //IQEnvironment.aum는 운용 자산 총액

	IQDate.addRebalSchedule(IQDate.setYearly(4, 3)); // 리밸런싱 주기를 매년 4월 1일로 설정
	IQDate.addRebalSchedule(IQDate.setYearly(6, 3)); // 리밸런싱 주기를 매년 6월 1일로 설정
	IQDate.addRebalSchedule(IQDate.setYearly(9, 3)); // 리밸런싱 주기를 매년 9월 1일로 설정
	IQDate.addRebalSchedule(IQDate.setYearly(12, 3)); // 리밸런싱 주기를 매년 12월 1일로 설정

//	IQDate.addRebalSchedule(IQDate.setMonthlyStart(1)); //리밸런싱 주기를 매월 1일로 설정
	IQEnvironment.simulationMethod = SimulationMethod.average ;

}

/////////////////////////////////////////////////////////////////////
//                          종목 선정                              //
////////////////////////////////////////////////////////////////////
////////////////////////
//     팩터 계산       //
////////////////////////
// n Value Logic. number형에서 "", null, NAN, undefined, "abc" Infinity, -Infinity 을 0으로 고침
function nvl(value){  
    if (typeof value !== 'number' || !isFinite(value)){
        return 0;
    }
    return value;
} 
function cap(stock) {
    return nvl(stock.getMarketCapital()) * 1000;
}
///////index rank_sum을 위해 팩터를 높을수록 저평가로 바꿔주기.
// PBR역 구하기. PBR이 낮을수록 저평가
function bp(stock){
    var totalEquity = nvl(stock.getFundamentalTotalEquity());    
    if (cap(stock) === 0){
    	return 0;
    }    
    return totalEquity/cap(stock); 
}

//EV/EBIT 역 구하기. EV/EBIT이 낮을수록 저평가. EV=기업가치, EBIT=연간순이익. 
function eveb(stock){
    var ebit = nvl(stock.getFundamentalEBIT()); 
    var ev = nvl(stock.getFundamentalEV()); 
    if (ev <= 0){
        return ;
    }  
    if (ev === 0){
        return 0;
    }
    return ebit/ev; 
}
 
// GPA 구하기 : 매출총이익/자산총계. 높을수록 영업 깨끗한 수익성 지표. 효율성 지표. 손익계산서는 밑으로 내려갈수록 조작이 쉽고 GP는 신뢰성이 높음.
// ROE보다 ROA가. ROA보다 GPA가 좋다. ROE는 데이터 왜곡. ROA의 return은 기업의 실제 수익성과 연관이 떨어짐.
function gpa(stock){
    var Revenue = nvl(stock.getFundamentalRevenue()); //매출액
    var SalesCost = nvl(stock.getFundamentalSalesCost()); //매출원가
	var TotalAsset = nvl(stock.getFundamentalTotalAsset());
    var GrossProfitAnnualized = (Revenue - SalesCost) * 4;    
    if (TotalAsset === 0){
        return 0;
    }
  return  GrossProfitAnnualized/TotalAsset;
}
////////////////////////
//    유동성 필터      //
////////////////////////
//일거래대금의 중앙값(median) 구하기
function MMTA(stock){
    var arrayMMTA=[];   
//    stock.loadPrevData(0,4,0); //사이트 내부적으로 과거데이터를 가져와줌.
    for (var i=0; i <21;i++) {
        arrayMMTA[i] = stock.getTradingValue(i);
    }    
    arrayMMTA.sort(function(a, b) { return a - b; }); // 오름차순    
    return arrayMMTA[10]; //평균의 허상이 있을 수 있으므로 중앙값 있을 수 있으므로 중앙값
}
function TradingValueFilter(stock){ 
    var FilterPass_yn = 'Y'
    var thisYear = IQIndex.getIndex("001").getDate(0).getFullYear();
    var mata = MMTA(stock);
    if      (thisYear >= 2015  && thisYear < 2016 &&  mata < 81.93)  { FilterPass_yn = 'N';  } //경제성장률(실질GDP증가율)+물가상승률 계산  
    else if (thisYear >= 2016  && thisYear < 2017 &&  mata < 84.8)  { FilterPass_yn = 'N';  }   
    else if (thisYear >= 2017  && thisYear < 2018 &&  mata < 88.11)  { FilterPass_yn = 'N';  }   
    else if (thisYear >= 2018  && thisYear < 2019 &&  mata < 92.61)  { FilterPass_yn = 'N';  }   
    else if (thisYear >= 2019  && thisYear < 2020 &&  mata < 96.69)  { FilterPass_yn = 'N';  }   
    else if (thisYear >= 2020  && thisYear < 2021 &&  mata < 99.2)  { FilterPass_yn = 'N';  }   
    else if (thisYear >= 2021  && thisYear < 2022 &&  mata < 99    )  { FilterPass_yn = 'N';  } 
    else if (thisYear >= 2022  && thisYear < 2023 &&  mata < 105.73)  { FilterPass_yn = 'N';  }
	else if (thisYear >= 2023  && thisYear < 2024 &&  mata < 113.77)  { FilterPass_yn = 'N';  }
    else if (thisYear >= 2024  && thisYear < 2025 &&  mata < 119.46)  { FilterPass_yn = 'N';  }
    else if (thisYear >= 2025  && thisYear < 2026 &&  mata < 124.84)  { FilterPass_yn = 'N';  }
    return FilterPass_yn;
}
////////////////////////
//     종목 필터링     //
////////////////////////
function port_Value(universe, stock_number){
    var UniverseArray = universe.slice();
    var UniverseFilter = universe.slice().filter(function(stock){        
        if (TradingValueFilter(stock) === 'N'){
            return false;
        }    //거래금액 기준에 못미치는 종목 제거
        return true;
    });     
    var sortedBybp = UniverseFilter.slice().sort(function(a, b){
        return bp(b) - bp(a);
    }); 
    var sortedByeveb = UniverseFilter.slice().sort(function(a, b){
        return eveb(b) - eveb(a);
    });     
    var sortedBygpa = UniverseFilter.slice().sort(function(a, b){
        return gpa(b) - gpa(a);
    });     
    
    UniverseFilter.forEach( function(stock){
        stock.setScore('rank_sum', 
                         sortedBybp.indexOf(stock) 
                       + sortedByeveb.indexOf(stock) 
                       + sortedBygpa.indexOf(stock) 
                      ); 
    });
    var Port_Rank = UniverseFilter.slice().sort( function(a, b){
    	return a.getScore('rank_sum') - b.getScore('rank_sum');
    });  
//////소형주 최적화///////
    var port_cut = Port_Rank.slice(0, Math.floor(Port_Rank.length * 2/3) );     //우량 가치 팩터 기준 최악의 33.33% 제거
    var sortedByCap = port_cut.slice().sort(function(a,b){
        return cap(a) - cap(b);
    });    
    
    return  sortedByCap.slice(0, stock_number);        
             
}


/////////////////////////////////////////////////////////////////////
//                  가치 가중(종목 당 수량 계산)                     //
/////////////////////////////////////////////////////////////////////
////////////////////////
//     팩터 계산       //
////////////////////////
// PCR역 구하기
function cp(stock){
    var OperatingCashFlow = nvl(stock.getFundamentalOperatingCashFlow());
    if (cap(stock) === 0){
        return 0;
        }
    return OperatingCashFlow/cap(stock); 
}

// PSR역 구하기
function sp(stock){
    var Revenue = nvl(stock.getFundamentalRevenue());
    if (cap(stock) === 0){
        return 0;
    }
    return Revenue/cap(stock); 
}

// PER역 구하기
function ep(stock){
    var NetProfit = nvl(stock.getFundamentalNetProfit());
    if (cap(stock) === 0){
        return 0;
    }
    return NetProfit/cap(stock); 
}

// POR역 구하기
function op(stock){
    var OperatingIncome = nvl(stock.getFundamentalOperatingIncome());
    if (cap(stock) === 0){
        return 0;
    }
    return OperatingIncome/cap(stock); 
}

// PIR 영업이익증가액/시가총액
function pir(stock){  //성장성지표
//    stock.loadPrevData(1, 4, 0); //사이트 내부적으로 과거데이터를 가져와줌.
    var oIncome0 = nvl(stock.getFundamentalOperatingIncome());
    var oIncome4 = nvl(stock.getFundamentalOperatingIncome(4));
    if (oIncome0 <= 0 || oIncome4 < 0) {return -99999999999999;}    
    if (cap(stock) === 0){ 
        return 0;
    } 
    return  (oIncome0-oIncome4)/cap(stock); 
}

// 볼린저밴드 폭. 작을수록 가치 가중
function bnd(stock){
//    stock.loadPrevData(1, 4, 0); //사이트 내부적으로 과거데이터를 가져와줌.
    var upper = nvl(stock.getBollingerBand(240, 1, 1).upper)
    var lower = nvl(stock.getBollingerBand(240, 1, 1).lower)
	if (lower === 0){
        return 0;
    }
    return (upper / lower) * 100;
}

// RSI 구하기
function rsi(stock){           
//    stock.loadPrevData(0, 4, 0); //사이트 내부적으로 과거데이터를 가져와줌.
    return nvl(stock.getRSI(rsiPeriod));
}

// 배열 합계 구하기 함수
function sum(array){
  var result = 0.0;
  for (var i = 0; i < array.length; i++){
    var val = array[i];
    if (typeof val !== 'number' || !isFinite(val)){
      continue; //비정상 값은 0으로 처리하여 합산에 영향 없게 함
    }
    result += val;
  }
  return result;
}

////////////////////////
//   가치 가중 실행    //
////////////////////////
// 동일비중 투자는 stockWeight 0으로 설정하고, 0보다 크면 가치가중으로 매수함 														
function Port_Control(basket, account, universe, stockWeight, value_weight, pcrRatio, psrRatio, perRatio, porRatio, pirRatio, bndRatio, rsiRatio) {

    var PCR_SCORE = [];
    var PSR_SCORE = [];
    var PER_SCORE = [];
    var POR_SCORE = [];
    var PIR_SCORE = [];
    var BND_SCORE = [];
    var RSI_SCORE = [];   

// 각 종목별 팩터 점수 계산 및 정제. 수집(puch)
    universe.forEach(function(stock){
// 모든 투자 유니버스 종목에 대해 개별 팩터 값 산출
// Math.pow(x, powerNumber)를 적용하여 powerNumber에 따른 가치 가중 효과 증폭
// 음수이거나 비정상적인 팩터 점수를 0으로 정제하여 이후 계산에서 안정성 확보
// 정제된 팩터 점수를 각 팩터별 스코어 배열에 추가

        var vcp = cp(stock); if (vcp <= 0) vcp = 0;
        PCR_SCORE.push(Math.pow(vcp, powerNumber));
        
        var vsp = sp(stock); if (vsp <= 0) vsp = 0;
        PSR_SCORE.push(Math.pow(vsp, powerNumber));

        var vep = ep(stock); if (vep <= 0) vep = 0;
        PER_SCORE.push(Math.pow(vep, powerNumber));

        var vop = op(stock); if (vop <= 0) vop = 0;
        POR_SCORE.push(Math.pow(vop, powerNumber));

        var vpir = pir(stock); if (vpir <= 0) vpir = 0;
        PIR_SCORE.push(Math.pow(vpir, powerNumber));

        var vbnd = 1 / bnd(stock); if (vbnd <= 0) vbnd = 0;
        BND_SCORE.push(Math.pow(vbnd, powerNumber));

        var vrsi = 100 - rsi(stock); if (vrsi < 0 || vrsi > 100) vrsi = 0;
        RSI_SCORE.push(Math.pow(vrsi, powerNumber));
    });

    var TotalEquity = account.getTotalEquity(); //총 예산
    var port_Budget = TotalEquity * stockWeight; //전체 포트폴리오에 주식 자산으로 할당된 총 예산. 현재 절대 모멘텀 적용. 0.95 or 자산 배분 시 0
    var stock_Budget = port_Budget / universe.length; //'균등하게 나눴을 때' 각 종목에게 돌아가는 예산. universe.length = stock_num

    var TOT_PCR_SCORE = sum(PCR_SCORE);
    var TOT_PSR_SCORE = sum(PSR_SCORE);
    var TOT_PER_SCORE = sum(PER_SCORE);
    var TOT_POR_SCORE = sum(POR_SCORE);
    var TOT_PIR_SCORE = sum(PIR_SCORE);
    var TOT_BND_SCORE = sum(BND_SCORE);
    var TOT_RSI_SCORE = sum(RSI_SCORE);
    
// 분모가 0이 되는 것을 방지하기 위한 안전장치
    if (TOT_PCR_SCORE === 0) { pcrRatio = 0; TOT_PCR_SCORE = 1; } //2003년 6월 이전은 PCR 이 없음으로 가치가중에서 제거한다.
    if (TOT_PSR_SCORE === 0) { psrRatio = 0; TOT_PSR_SCORE = 1; }
    if (TOT_PER_SCORE === 0) { perRatio = 0; TOT_PER_SCORE = 1; }
    if (TOT_POR_SCORE === 0) { porRatio = 0; TOT_POR_SCORE = 1; }
    if (TOT_PIR_SCORE === 0) { pirRatio = 0; TOT_PIR_SCORE = 1; }
    if (TOT_BND_SCORE === 0) { bndRatio = 0; TOT_BND_SCORE = 1; } //2001년 2월 이전은 1년 볼린저밴드 스코어가 없음으로 가치가중에서 제거한다.
    if (TOT_RSI_SCORE === 0) { rsiRatio = 0; TOT_RSI_SCORE = 1; }

    basket.reset(); //리밸런싱 시 기존 포지션 삭제.
    var i = -1; //반복문이 아니기에 forEach() 밖에서 증가돼야 함. forEach() 안에 있으면 계속 -1이 됨.

// 최종 예산 결정. 실제 매수 수량 계산. basket.enter()로 매매 지시.
    universe.forEach(function(stock) {
// '가치가중'을 통한 자금 배분 및 실제 주문 작업
        i++; // i = i + 1;
																				
        var sumOfRatios = pcrRatio + psrRatio + perRatio + porRatio + pirRatio + bndRatio + rsiRatio; //현재 1로 설정
        if (sumOfRatios === 0) {
            logger.debug("모든 팩터 가중치 합이 0입니다. 종목: " + stock.code + " 예산 0 처리");
            return; // 예산 0으로 처리하여 이 종목 건너뜀
        }

        var total_stock_budget = port_Budget * (
            ((PCR_SCORE[i] / TOT_PCR_SCORE) * pcrRatio) +
            ((PSR_SCORE[i] / TOT_PSR_SCORE) * psrRatio) +
            ((PER_SCORE[i] / TOT_PER_SCORE) * perRatio) +
            ((POR_SCORE[i] / TOT_POR_SCORE) * porRatio) +
            ((PIR_SCORE[i] / TOT_PIR_SCORE) * pirRatio) +
            ((BND_SCORE[i] / TOT_BND_SCORE) * bndRatio) +
            ((RSI_SCORE[i] / TOT_RSI_SCORE) * rsiRatio)
        ) / sumOfRatios;

// 최종 예산 결정
        var same_weight_ratio = 1 - value_weight; // 현재 가치 가중 비율 1
        var final_budget_for_quantity = (value_weight === 0) //if
            ? stock_Budget // 할당 // 동일 비중 // 현재 stock_Budget = 총 예산 * 0.95 / stock_num
            : (total_stock_budget * value_weight + (port_Budget * same_weight_ratio) / universe.length); // else 할당 // value_weight만큼 가치 가중. 나머지 동일 비중

// 종목 당 매수 수량 계산 및 지시
        var quantity = Math.floor(final_budget_for_quantity / stock.getAdjClose()); //(종목 당 예산 / 수정종가)//내림. 11.8주를 사야하면 11주만 삼.
 
        basket.enter(stock, quantity);

        var stock_ratio = ((quantity * stock.getAdjClose()) / TotalEquity) * 100;
        if (stock_ratio > 15) {
            logger.debug('단일 종목 비중 15% 초과: ' + stock_ratio.toFixed(2) + '%, 종목명: ' + stock.code + ', 수량: ' + quantity + '주');
        }
    });

    AssetAllocation(basket, account, stockWeight);

}

/////////////////////////////////////////////////////////////////////
//                           자산배분                              //
////////////////////////////////////////////////////////////////////
////////////////////////
//      ETF 매수      //
////////////////////////
function basketEnter(basket, account, code, ratio) {
    var sse = IQStock.getStock(code); 
    if (sse !== null) {
        var bond_amt = account.getTotalEquity() * ratio   
        var BO_quantity = Math.floor(bond_amt / sse.getAdjClose());  //수량 (종목당 예산 / 수정종가)
        basket.enter(sse, BO_quantity);
    }
}
////////////////////////
//   자산 배분 실행    //
////////////////////////
// 주식을 매수하고 남은 비중으로 자산배분(자산배분은 2011년 3월 부터 가능)
function AssetAllocation(basket, account, stockWeight){   
    
    if ( stockWeight < 0.95 ) {
            var gold_ratio  = (1 - stockWeight) * 0.15 ;                            //골드 비중 : (1 - 주식비중) * 15% 
            var bond_ratio  = (1 - stockWeight) - gold_ratio - 0.02 ;//채권 비중 : 1 -  주식비중 - 골드비중. 2% 는 현금 
    
            var US10Y_Tresaury = IQStock.getStock('A305080'); //TIGER 미국채10년선물 305080 2018년 08월 30일
            var KR10Y_Tresaury = IQStock.getStock('A148070'); //KOSEF 국고채10년 148070 2011년 10월 20일
            var USD            = IQStock.getStock('A138230'); //KOSEF 미국달러선물 138230 2011년 02월
            var KR_GOLD        = IQStock.getStock('A132030'); //KODEX 골드선물(H) 2010년 10월 01일     
            
            if (KR10Y_Tresaury.getClose() > 0 && US10Y_Tresaury == null) { 
                basketEnter(basket, account, 'A148070', bond_ratio * 0.5) ;        //KOSEF 국고채10년 
                basketEnter(basket, account, 'A138230', bond_ratio * 0.5) ;        //KOSEF 미국달러선물 
                var BondPct = bond_ratio * 0.5 * 100;
                var GoldPct = gold_ratio * 100;
                logger.debug('전략명: ' + account.accountName + " , 자산 비중: 국고채10년 " +  BondPct.toPrecision(4) + '% , ' +  '달러선물 ' +  BondPct.toPrecision(4) + '% , ' + ' Gold선물 ' + GoldPct.toPrecision(4) + '%') ;                                
            }                    
            else if (US10Y_Tresaury.getClose() > 0 ) { 
                basketEnter(basket, account, 'A305080', bond_ratio )   ;           //TIGER 미국채10년선물 
                var BondPct = bond_ratio * 100;
                var GoldPct = gold_ratio * 100;
                logger.debug('전략명: ' + account.accountName + " , 자산 비중: 미국채10년선물 " +  BondPct.toPrecision(4) + '% , ' + ' Gold선물 ' + GoldPct.toPrecision(4) + '%') ;                                
            }
        
            if (gold_ratio > 0) { 
            	basketEnter(basket, account, 'A132030', gold_ratio ) ;             //KODEX 골드선물(H)               
            }       
    }
}    
/////////////////////////////////////////////////////////////////////
//                          절대모멘텀                             //
////////////////////////////////////////////////////////////////////
function AbsoluteMomentum(IndexCode) {
/*IndexCode
001 : KOSPI
101 : KOSPI 200
002 : KOSPI 대형주
003 : KOSPI 중형주
004 : KOSPI 소형주
301 : KOSDAQ */    

    var Kindex = IQIndex.getIndex(IndexCode);  //004 
//    Kindex.loadPrevData(0, 16, 0); //사이트 내부적으로 과거데이터를 가져와줌.
    var current_price = Kindex.getClose();
    var PRICE_252 = Kindex.getClose(252);     //1년전 주가        
    var PRICE_42  = Kindex.getClose(42);      //두달전 주가        
    var MomentmRatio = 0.95 // 주식비중
    if (  current_price < PRICE_252 && ( current_price < PRICE_42 ) )  //절대모멘텀(1년)이 적용되고 최근 2개월 모멘텀도 음수일때(과최적화방지)
    { 
          var KR3Y_Tresaury  = IQStock.getStock('A114100'); //KBSTAR 국고채3년 114100 2009년 07월 29일            
          if (KR3Y_Tresaury == null) { MomentmRatio = 0; } else { MomentmRatio = 0; } //자산배분 시 주식 비율.
          logger.debug( '절대모멘텀 적용. 주식비중 : ' + MomentmRatio);                                           
    }        
    return MomentmRatio;
}    


/////////////////////////////////////////////////////////////////////
//                         리밸런싱 수행                            //
////////////////////////////////////////////////////////////////////
// 필터링 함수 정의 - 필터링 조건에 따라 종목들의 포함 여부 판단
function stockFilter(stock) {
    if (stock.getMarketCapital() === 0 || stock.getClose() === 0 || stock.getTradingValue() === 0 ) { return false; } //시총 없는 종목 제외, 종가가 0인 종목 제외, 거래정지 중인 종목 제외   
    if (stock.getFundamentalTotalAsset() === 0 || stock.getFundamentalTotalEquity() === 0) { return false; }      // 우선주 제외(자산총계가 없음), ETF 제외TF 제외
    if (stock.manage > 0 ) { return false; }                           // 관리종목, 투자유의종목 제외

    if ( stock.getFundamentalCapitalStock() > stock.getFundamentalTotalEquity() )  { return false; } //자본잠식 제외      
    return true;
}

// 리밸런싱 수행 
// 전역 변수 추가
var basket_weight = 0;
function onDayClose(now) {
    if (IQDate.isRebalancingDay(now)) {
        //|| isFirst === true) { //실제 투자 시에는 켜기. 현금 유보 방지
        var universe = IQStock.filter(stockFilter);
        var port_value = port_Value(universe, stock_num);  
        
        var AbsoluteWeight = AbsoluteMomentum('004') //kospi 절대모멘텀
                                                             //주식비중,   가치가중비율,  pcrRatio, psrRatio, perRatio, porRatio, pgrRatio, bndRatio, rsiRatio
        Port_Control(basket1, account1, port_value, AbsoluteWeight, valueWeightRatio1, 1,        1,       1,        1,        1,        1,        1);
        basket_weight = AbsoluteWeight;
//        isFirst = false; //실제 투자 시에는 켜기. 현금 유보 방지
    }
}
function onComplete() {
               
      IQLive.addPortfolio(basket1, basket_weight);
   
                
}    
    
    
    