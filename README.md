# AI Modernization Tool MVP

Minimal MVP that accepts a ZIP project, extracts technical context, stores lightweight file chunks on disk, retrieves relevant context, sends that context to OpenAI, and generates a modernization specification in markdown.

## Stack

- Frontend: React + Vite + TailwindCSS + JavaScript
- Backend: Node.js + Express + JavaScript
- AI/RAG: OpenAI for generation, OpenAI embeddings, ChromaDB vector retrieval, and local keyword fallback when vector services are unavailable

## Architecture

- Upload ZIP project to the Express backend
- Extract the ZIP to a temporary workspace
- Detect React, Node.js, Express, Java, and Spring Boot details from source, `package.json`, Maven, and Gradle files
- Parse Express APIs, Spring controller APIs, and dependencies
- Build and store lightweight local context chunks
- Retrieve relevant context with ChromaDB vector RAG when available, or local keyword scoring as a fallback
- Send summary context plus retrieved context to OpenAI
- Save and display `modernization-spec.md`

## Run

1. Install dependencies:

```bash
npm install
```

2. Create [.env](.env) in the project root with:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:5174,http://localhost:5175
CHROMA_HOST=api.trychroma.com
CHROMA_PORT=
CHROMA_SSL=false
CHROMA_API_KEY=your_chroma_key_here
CHROMA_TENANT=your_chroma_tenant
CHROMA_DATABASE=modernization_specs
CHROMA_COLLECTION_NAME=project_contexts
RAG_TOP_K=8
MAX_RAG_FILES=30
MAX_FILE_CHARS=8000
CHUNK_SIZE=1600
CHUNK_OVERLAP=200
VITE_API_BASE_URL=http://localhost:4000/api
```

3. Start backend:

```bash
npm run dev:backend
```

4. Start frontend:

```bash
npm run dev:frontend
```

## Notes

- The backend does not require Postgres or pgvector.
- Lightweight RAG context is stored locally under `tmp/knowledge` as JSON files.
- The generated spec is based on ZIP extraction, dependency parsing, Express/Spring route extraction, stored context chunks, and retrieved context sent to OpenAI.
- If OpenAI embeddings or ChromaDB are unavailable, the app falls back to local keyword RAG instead of failing the request.
- If `OPENAI_API_KEY` is missing, the app falls back to a locally generated markdown spec.

## Accuracy Report
[spec_accuracy_report.pdf](https://github.com/user-attachments/files/27696883/spec_accuracy_report.pdf)
%PDF-1.4
%���� ReportLab Generated PDF document http://www.reportlab.com
1 0 obj
<<
/F1 2 0 R /F2 3 0 R
>>
endobj
2 0 obj
<<
/BaseFont /Helvetica /Encoding /WinAnsiEncoding /Name /F1 /Subtype /Type1 /Type /Font
>>
endobj
3 0 obj
<<
/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding /Name /F2 /Subtype /Type1 /Type /Font
>>
endobj
4 0 obj
<<
/Contents 10 0 R /MediaBox [ 0 0 612 792 ] /Parent 9 0 R /Resources <<
/Font 1 0 R /ProcSet [ /PDF /Text /ImageB /ImageC /ImageI ]
>> /Rotate 0 /Trans <<

>> 
  /Type /Page
>>
endobj
5 0 obj
<<
/Contents 11 0 R /MediaBox [ 0 0 612 792 ] /Parent 9 0 R /Resources <<
/Font 1 0 R /ProcSet [ /PDF /Text /ImageB /ImageC /ImageI ]
>> /Rotate 0 /Trans <<

>> 
  /Type /Page
>>
endobj
6 0 obj
<<
/Contents 12 0 R /MediaBox [ 0 0 612 792 ] /Parent 9 0 R /Resources <<
/Font 1 0 R /ProcSet [ /PDF /Text /ImageB /ImageC /ImageI ]
>> /Rotate 0 /Trans <<

>> 
  /Type /Page
>>
endobj
7 0 obj
<<
/PageMode /UseNone /Pages 9 0 R /Type /Catalog
>>
endobj
8 0 obj
<<
/Author (\(anonymous\)) /CreationDate (D:20260513062224+00'00') /Creator (\(unspecified\)) /Keywords () /ModDate (D:20260513062224+00'00') /Producer (ReportLab PDF Library - www.reportlab.com) 
  /Subject (\(unspecified\)) /Title (\(anonymous\)) /Trapped /False
>>
endobj
9 0 obj
<<
/Count 3 /Kids [ 4 0 R 5 0 R 6 0 R ] /Type /Pages
>>
endobj
10 0 obj
<<
/Filter [ /ASCII85Decode /FlateDecode ] /Length 2155
>>
stream
Gat=+gN)%,&:O:Slq9*O`g02b]&h2g,b8Q4=DI`](Pi2C`#u#jUh&TQHZ1,sb*"+#dFb2/h8R4uip<gD*^7=6+([jLF1Q\iaU`'VO<4s!Rf>Yao<TNO^68sq1n&/fX?kQY%9u7Y,MsRGr\]/M@gXPdqs#o/^tA8&VbH@QCD$.n(I)%KMO\9/*mkXZ?K`_nlB4S?H;@m:>+4'XdJQ)N5EJ)L%Dp6.RQc5^9SnIbU>"$O?PR/&aBeY;nR+2E>!ZQrL//okd,<ec%7fB.;u'qL*%P]_id:X!4M:6`Y/HdXXNiS%D@I*96mJZSl+cicP1-E^efs62AN^8H3'\`5ZG0Go'/@gj>ZG_D=2YA?7@k,BUSXo6<5D4JhhVk>\$QatZ>mmp&nu5Wk8!N'[=m-G62Ic<!5fO)f1,XhDP"R=``=UPV\bRTc6pRD?>V?OjY;U.-$dN%b.^K+27@.C`!:t5[9LX><:?W3eBA%%gTgu>Ld?rqS<BVBRkL+%!E#\!dd@DpIE*4jg!mQ+&^Q@r?,A<2'@LPMk5graKC973In9/?SOZ+"[*)?4+]V$*@Z'THn4M(+oJF<f0SOq#Sr0'0;@BNWTO`q[JkEbUKoDutfSWQl"s/PLA.p<WAm,O,9'SOe92%5t4G,nU9Lr4DoE4]Z9n`gPM2^[dQTR$3Y)NHk:&_J`$*<lFGCK?Y0#a8i4J.ShdD%t$U8e015Q)(.WafsTohs^ufu^F">9I4^%b.\LS9hqZ1?L)iCip6@]ZZM%=XV`GLX4n7\;oA;5CbhCf*(*[oaerZs8!6r'F`%Uq@=ph3#qe%s';L7\JCcqC$9ha)%;(LOq22Xl,Xf>6JDHW'LmXRcjs0P@?333[gd5u0gOM;TFhINnETh?^>+F;(ONHJS3P[ucCtBp>f!Fa=?,LM5BCepMs:TA_>1"FKi;Ib)>2L9q[&3V@59hDc,i)\7U/QV">IS)?k'?temu_TCt;7d_o?*Lg,Glc\UCmHFon-HT)'h=3LNZ3Tp[-3'a".u^'776a+2nV=a"OQ(djuRk]X&Ql-;'($(+J'H7HL$AnK6+5&o0uf!Ki6f5t\jmodUd7D:@mDa?CK8U)5='DVkf]o74<c38FA(#4KM!0Aqu.peBrQ:ORK/Y\i1#TNq,*ZK0A%b?1(bZ2F<&=pZ`3"F>mR,GE#F$UF$DTNeBN-\`+,$srCUYpl*GIc31oWF[9qef7n%aled:0\;WEXO]W-N.bON;6XF*3`/X!&C\[PB,EfpDD?*k4AP3EM#6YiT0:FiA=0)F=Q!>`&;pI6>r"tQR7kQHD+ii!h7&Do$P[g,0*P@L$=Eo4-@9<Y,Z9:%[=*(Pr]giA*$MBa@HX"1M%GaZQ2E^`1DdjFl2gZOH%1kh-Jqc,\V_8bBaWT,n_?WRbk;Z8(Y-*nb:l0q"#m2fX-no1SmW,8Xc&Ic`MK+Q*-'oqc6YI1Ui7>FqrQXXl?<c7<@Hhn^O^fP@bP*c0D[hCq@M@DRLJPFrE7X%<q\S2qqS]G%imLp@'I'7/D7SU;3l8S^hXsgP=]J3&j)!TAebc1p`j@3KKId3_N$TCF8?f9=u8j3fT.ad&$7q4X-(?h1NBi_L6P_K,b^dlr=$g\-_,lAruG7.$B$,RPYtl/3,t2SUp/"'lRm\"lQdu_58Vf&m9#b#aK670Rq3@0s?mPL"/_'(8.1/Ad#Au?c@."ck+o_J0B_-khnHX4(t?=\^a%QL(%'8^k'%-^NO[[%BbW+\LK[q/XRIuEAWF@$hi(\+C;UkP^L_e6O[sO-A11*gM>t:(E7%P(WLXU]dQW`#RMlZO#f=a:qD3pbJL!ki\u-h<2T[q!6a>e!io%QZq$74k3)AoQXs$#+_'!1@Ju[#2pckXFOD*#c=soSi:&8_fn=oT9IU`($u['K?pM3(]77!h`"k_T,NpMC)8X2UZ(8aR`p)olh]c(%9R50Z3DEI3kRD\a'q;J6SM-!s]1F/g;X#&:f7tqggXb"#%(XAdX#i?e!Eb'Ik;m>9+B[PJ&l<3TC+,Z-@MDE7Y0aq&,>kf6R&n\*>^KK1R\0o8;4o5$V)uY6oWAkgJUfFl<\kFWAUj4:G@u95Fgkk1Ogi%i+sCrb,EVJ.#[QqUeV\jPB3[$+Db4TjgKL#>hBnjdJ)LMF8%.a5gRF\rlp!Y^65B~>endstream
endobj
11 0 obj
<<
/Filter [ /ASCII85Decode /FlateDecode ] /Length 2037
>>
stream
GasapgN)%.%"7SGn7a9)$!g,gI-FkEh/9jRc;%Ti^=*]GZ_8ut,q%QQ?[ri)`GME0V_s&;2ujFR0JSLT'ANQYMQoBhm+)!#`<k9>=I_!A[en#BgqELQ+s'LV/!a`q*_%0ANe;t/K1;+`rT'J:j<V#Q?*]rLKp%/RA5b9](T`cgU#96j@&DDIK2R;0n/tHG50Hj9PKj(gjIJElYNR5oZqBJdA&#A+G=5",Pagcd]b?sh$No`S.pe_SB730apQFA!Ndq^dPbQ:s$L5q8eEZ0A$UUZ1R_!$T;s2MN]hkf6$dbcg$mbhH3NruVF[DGA0p<]Q&jpj!pH^\2$QB0+IVA0."Srli&UB.dHNiK%8g*HFgbO]d%tK64-l<^.;^+AMeY'!BN2)I9&LpkJ<p39cV9Vd$a]%%^i@kR[86?d2JZ*Eh:s2<aW(U7qBSQ)IO%bd?!`k.6VCe'B2$M>a(srBVCBd364Jr7AiaiHhOe5e4.qNeT_blrN\Hs]0E7\ck;p`I@XN;NK;!17BV,Y$'C+o.iEC3tESKcI#qPQ2=1UO/B'6-fF>_Eclm'6GL7RhN6O@7]T/QI^\>;.hJi)FW2k8fX[JOrEZ]/+5fW,&4,QF3@rNNT?9RgJqsnXJ9poA^T?n=umlZ!h03h1^,3m9kWZd3,Z_^mHXt5"fD,#UpP/KiZ!)p@dOI\*mEL>>T"P3iFaBNeXGq8aP'OdF`1/E7NXdhLIfcPR:iZqaTf/_A*8VoXR+h274^d&:^A5r"Bt$K)4W1%j*6GMj8_+s/QnI*R7U=Qkj`/>bi;V3QgoKm@+W@fLYbB4/-pON9ulSF=Te%hrm-?/E9jM!&<bFHZFHZo^,Iu)@S\j+\C`[5q!)\*)X_,@<P*IS17r/!ojT/d?K]KVsZNS=?(h'hLWlIMS=#so"Z57C!k^X#"_c:1j^2LCQCG]L(/kseO1)EQlTls\e[pI9%Pta2`a1G%Ocb!6B261d^\.$2pQ(A37hY$%9TV>Hf$5fi_^R$3(Tk&?_6HnQbXF84C/.`]*PRIdBF\iec0kiUpMFa&#FHkChR22Hukuh*AK:]LtEXdN&*4RKqE6@fD+[!ALe##fHfc>MqRb^##nM@bCl_XLiJ@R1HrI!Z.Q4Rod48/Ha=oS@"88^!tq-C35`pA\.sf#O7L:uj"4j11EGR73k!6b#=BrSi84!F'J(j=o`SM6>;,EEPQ/1"VjUag`<>sDp&X@Hf;DYc\QRWB;9\W<C[>Af$aBeOqPk2)4:0r*-NR89"%[Y;eCm_16@Ll\H*I,RL$YifIA^lDHc^WVnQOk+^<YP'N()lHkdV_GBuIj>A1i^K1J.sL"0PO,"i0)*f[KbkRu/gA]\S6-hu]cA#D\M9Z"#N2#di,iYC5.+=-k#2[;!-q^*/[,ck*8)&@crc+#8#W:\sgoPQ'0$5HM,+P`=XrPm3.9hd"_[KPY6=cT@P4O!G[uA&I,tc6?5^D=QbYp7KSg6a@]#@>b;@p6lD+Fs5C0]pA9^-]-k7Nd-P$0+Es?pS4)/6I*@lc_*FAeAX-YQR)din"(DMBV,!Dj#Dr1IL:QfE8@R_VXeno^/p>uGf_VB`+Ms*/LS60Ni"etSQi_]YMEpMkrcZLEhGAOUF1o3b=4/9q9enb-F)Q]it\K44/[4qG^.q;qiBnXh@9[lq=$puH-k<+q`f'I6+6AYY6Ud\f`(XYX6="B/iiF,&MoBLk6]H=^:1TUb7a$XMTqsd03=-4fQZ-s6oNA<lKChaY,/Zb[SZ`[m]3dcS[S/.j6YDj@Xmtim&Q5'=5gLZqr$R7F8odI*)+3[G2Z`_JMc02L&-LQHN3r's1T!sZEJc:&,5%N=4qd:8W%r&g1\i%O#5lQm^GDbdc58mU?&`*m:t"2'X[1cf:itd/+8h#TM9j),R&&Ed7=Vu.%j!FZt/4E8.+(Y7jBHr1QP"'cn7I"8O4;B1m5L0hKh#AJp-2%8.+(97jBHr;iaCGcmBfnUnE\K>'*'bHEcc?C[IhH(So7WAYU/u&rociLrWV0XpaIJGJP*m@5%TbKIg&%~>endstream
endobj
12 0 obj
<<
/Filter [ /ASCII85Decode /FlateDecode ] /Length 685
>>
stream
Gas1\?#SIO%"-C)i6-XglURJQ>FW+'97['H[MI`nX@S;f<gHu^DO:=uS`J:6q_/9^Cl5ke*pJQZ3*#e+/^`1=:9H(HAlN]I3^#['qO3`CjC(sR1J^6aQW]%'aj'/8g%hNcI@(#0)I]ZaT\9Hl%Hn[0dgSAk-T#pa,u.V>`PI@*n#=#?"I(I;5Et%k]p2-j2]S@c<CsiufWga%ki&XBqOWc^V/[gHP227(qaW"+a?_[Wg:*U[CaaRd8NEPtTiRU95T$^%Q<btYa$iRs?DWT2D.e.,4n:o.biY!&X.t99A8V.(J-tZ$>m'p4&0pt-^*%,[?/Wf_nHHnaiaj250Ss;&<WO0)`TAAc%D;,J6MZoRgeI=?$iZ0/Ra^-$B5\=+0B`Pbe$j4T>e_S%$eE=%l^u*QUl:G;.NXn6ln/_4_&6?XJLIX:[T%1!@Hthb]8sJMW(<W6`PINNcALfWF%&q2Af%p?7F20(;:pl2[d"@-/s#+[@g<\KkSd_#SJTrJC)XJWUNE6LNtj&bH<>8%L+4V%>AdH:D^q`o6=>(37MM`R`f][%,P!JA$e%-nk#)1g"SlH$fsd&n9c>^J(,!oV#D]!^-A3is*S,q.&f^(^hC`RM\UBmN7Ak>.9`8EO95I;cJj_dhT4[iTKmq/h)E%m`p1F?gH0*2#N4Xu9oEL'trrDit6<s~>endstream
endobj
xref
0 13
0000000000 65535 f 
0000000073 00000 n 
0000000114 00000 n 
0000000221 00000 n 
0000000333 00000 n 
0000000527 00000 n 
0000000721 00000 n 
0000000915 00000 n 
0000000983 00000 n 
0000001266 00000 n 
0000001337 00000 n 
0000003584 00000 n 
0000005713 00000 n 
trailer
<<
/ID 
[<bfc9e8cf4b9d87e1b3ed557fa372db9e><bfc9e8cf4b9d87e1b3ed557fa372db9e>]
% ReportLab generated PDF document -- digest (http://www.reportlab.com)

/Info 8 0 R
/Root 7 0 R
/Size 13
>>
startxref
6489
%%EOF
