import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CommunityService } from './community.service';
import { CommunityStorageService } from './community-storage.service';
import { ZcWalletService } from './zc-wallet.service';

describe('Community clip mini-tests', () => {
  const manager={query:jest.fn()};
  const db={query:jest.fn(),transaction:jest.fn((fn:(m:typeof manager)=>unknown)=>fn(manager))};
  const wallet={credit:jest.fn().mockResolvedValue({})};
  let service:CommunityService;
  beforeEach(()=>{
    jest.clearAllMocks();
    db.transaction.mockImplementation((fn:(m:typeof manager)=>unknown)=>fn(manager));
    service=new CommunityService({} as Repository<any>,{} as Repository<any>,{} as Repository<any>,{} as Repository<any>,{} as Repository<any>,{} as Repository<any>,{} as CommunityStorageService,db as unknown as DataSource,wallet as unknown as ZcWalletService);
  });
  it('does not expose the correct option to viewers',async()=>{
    db.query.mockResolvedValueOnce([{id:'quiz-1',author_id:'creator',correct_option:2,question:'2+2?',option_a:'2',option_b:'3',option_c:'4',option_d:'5'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{attempts_count:0}]);
    const result=await service.getClipQuiz('viewer','clip-1');
    expect(result).toMatchObject({question:'2+2?',options:['2','3','4','5'],attempted:false,isOwner:false});
    expect(result?.correctOption).toBeUndefined();
  });
  it('rewards a correct answer once with XP and idempotent ZC',async()=>{
    manager.query.mockResolvedValueOnce([{id:'quiz-1',author_id:'creator',correct_option:1}]).mockResolvedValueOnce([{id:'attempt-1'}]).mockResolvedValueOnce([]);
    const result=await service.answerClipQuiz('learner','clip-1',1);
    expect(result).toEqual({isCorrect:true,xpAwarded:5,zcAwarded:2});
    expect(wallet.credit).toHaveBeenCalledWith('learner',2,'Lavha mini-testini to‘g‘ri yechish','community-clip-quiz:quiz-1:learner');
  });
  it('retries an idempotent reward after a previously correct attempt',async()=>{
    manager.query.mockResolvedValueOnce([{id:'quiz-1',author_id:'creator',correct_option:0}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{is_correct:true}]);
    const result=await service.answerClipQuiz('learner','clip-1',0);
    expect(result).toEqual({isCorrect:true,xpAwarded:0,zcAwarded:2});
    expect(wallet.credit).toHaveBeenCalledWith('learner',2,'Lavha mini-testini to‘g‘ri yechish','community-clip-quiz:quiz-1:learner');
  });
  it('does not let the clip author farm their own quiz reward',async()=>{
    manager.query.mockResolvedValueOnce([{id:'quiz-1',author_id:'creator',correct_option:0}]);
    await expect(service.answerClipQuiz('creator','clip-1',0)).rejects.toBeInstanceOf(BadRequestException);
    expect(wallet.credit).not.toHaveBeenCalled();
  });
  it('requires four answer choices when a creator builds a quiz',async()=>{
    await expect(service.createClipQuiz('creator','clip-1',{question:'Savol?',options:['A','B'],correctOption:0})).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
